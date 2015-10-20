'use strict';

var utils = require('../../utils');
var collate = require('pouchdb-collate');

function getKey(obj) {
  return Object.keys(obj)[0];
}

function getValue(obj) {
  return obj[getKey(obj)];
}

// normalize the "sort" value
function massageSort(sort) {
  if (!Array.isArray(sort)) {
    throw new Error('invalid sort json - should be an array');
  }
  return sort.map(function (sorting) {
    if (typeof sorting === 'string') {
      var obj = {};
      obj[sorting] = 'asc';
      return obj;
    } else {
      return sorting;
    }
  });
}

var combinationFields = ['$or', '$nor', '$not'];
function isCombinationalField (field) {
  return combinationFields.indexOf(field) > -1;
}

// collapse logically equivalent gt/gte values
function mergeGtGte(operator, value, fieldMatchers) {
  if (typeof fieldMatchers.$eq !== 'undefined') {
    return; // do nothing
  }
  if (typeof fieldMatchers.$gte !== 'undefined') {
    if (operator === '$gte') {
      if (value > fieldMatchers.$gte) { // more specificity
        fieldMatchers.$gte = value;
      }
    } else { // operator === '$gt'
      if (value >= fieldMatchers.$gte) { // more specificity
        delete fieldMatchers.$gte;
        fieldMatchers.$gt = value;
      }
    }
  } else if (typeof fieldMatchers.$gt !== 'undefined') {
    if (operator === '$gte') {
      if (value > fieldMatchers.$gt) { // more specificity
        delete fieldMatchers.$gt;
        fieldMatchers.$gte = value;
      }
    } else { // operator === '$gt'
      if (value > fieldMatchers.$gt) { // more specificity
        fieldMatchers.$gt = value;
      }
    }
  } else {
    fieldMatchers[operator] = value;
  }
}

// collapse logically equivalent lt/lte values
function mergeLtLte(operator, value, fieldMatchers) {
  if (typeof fieldMatchers.$eq !== 'undefined') {
    return; // do nothing
  }
  if (typeof fieldMatchers.$lte !== 'undefined') {
    if (operator === '$lte') {
      if (value < fieldMatchers.$lte) { // more specificity
        fieldMatchers.$lte = value;
      }
    } else { // operator === '$gt'
      if (value <= fieldMatchers.$lte) { // more specificity
        delete fieldMatchers.$lte;
        fieldMatchers.$lt = value;
      }
    }
  } else if (typeof fieldMatchers.$lt !== 'undefined') {
    if (operator === '$lte') {
      if (value < fieldMatchers.$lt) { // more specificity
        delete fieldMatchers.$lt;
        fieldMatchers.$lte = value;
      }
    } else { // operator === '$gt'
      if (value < fieldMatchers.$lt) { // more specificity
        fieldMatchers.$lt = value;
      }
    }
  } else {
    fieldMatchers[operator] = value;
  }
}

// combine $ne values into one array
function mergeNe(value, fieldMatchers) {
  if ('$ne' in fieldMatchers) {
    // there are many things this could "not" be
    fieldMatchers.$ne.push(value);
  } else { // doesn't exist yet
    fieldMatchers.$ne = [value];
  }
}

// add $eq into the mix
function mergeEq(value, fieldMatchers) {
  // these all have less specificity than the $eq
  // TODO: check for user errors here
  delete fieldMatchers.$gt;
  delete fieldMatchers.$gte;
  delete fieldMatchers.$lt;
  delete fieldMatchers.$lte;
  delete fieldMatchers.$ne;
  fieldMatchers.$eq = value;
}

// flatten an array of selectors joined by an $and operator
function mergeAndedSelectors(selectors) {

  // sort to ensure that e.g. if the user specified
  // $and: [{$gt: 'a'}, {$gt: 'b'}], then it's collapsed into
  // just {$gt: 'b'}
  var res = {};

  selectors.forEach(function (selector) {
    Object.keys(selector).forEach(function (field) {
      var matcher = selector[field];
      if (typeof matcher !== 'object') {
        matcher = {$eq: matcher};
      }

      if (isCombinationalField(field)) {
        if (matcher instanceof Array) {
          res[field] = matcher.map(function (m) {
            return mergeAndedSelectors([m]);
          });
        } else {
          res[field] = mergeAndedSelectors([matcher]);
        }
      } else {
        var fieldMatchers = res[field] = res[field] || {};
        Object.keys(matcher).forEach(function (operator) {
          var value = matcher[operator];

          if (operator === '$gt' || operator === '$gte') {
            return mergeGtGte(operator, value, fieldMatchers);
          } else if (operator === '$lt' || operator === '$lte') {
            return mergeLtLte(operator, value, fieldMatchers);
          } else if (operator === '$ne') {
            return mergeNe(value, fieldMatchers);
          } else if (operator === '$eq') {
            return mergeEq(value, fieldMatchers);
          }
          fieldMatchers[operator] = value;
        });
      }
    });
  });

  return res;
}

//
// normalize the selector
//
function massageSelector(input) {
  var result = utils.clone(input);
  var wasAnded = false;
  if ('$and' in result) {
    result = mergeAndedSelectors(result['$and']);
    wasAnded = true;
  }

  if ('$not' in result) {
    //This feels a little like forcing, but it will work for now,
    //I would like to come back to this and make the merging of selectors a little more generic
    result['$not'] = mergeAndedSelectors([result['$not']]);
  }

  var fields = Object.keys(result);

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var matcher = result[field];

    if (typeof matcher !== 'object') {
      matcher = {$eq: matcher};
    } else if ('$ne' in matcher && !wasAnded) {
      // I put these in an array, since there may be more than one
      // but in the "mergeAnded" operation, I already take care of that
      matcher.$ne = [matcher.$ne];
    }
    result[field] = matcher;
  }

  return result;
}


function massageIndexDef(indexDef) {
  indexDef.fields = indexDef.fields.map(function (field) {
    if (typeof field === 'string') {
      var obj = {};
      obj[field] = 'asc';
      return obj;
    }
    return field;
  });
  return indexDef;
}

function getKeyFromDoc(doc, index) {
  var res = [];
  for (var i = 0; i < index.def.fields.length; i++) {
    var field = getKey(index.def.fields[i]);
    res.push(doc[field]);
  }
  return res;
}

// have to do this manually because REASONS. I don't know why
// CouchDB didn't implement inclusive_start
function filterInclusiveStart(rows, targetValue, index) {
  var indexFields = index.def.fields;
  for (var i = 0, len = rows.length; i < len; i++) {
    var row = rows[i];

    // shave off any docs at the beginning that are <= the
    // target value

    var docKey = getKeyFromDoc(row.doc, index);
    if (indexFields.length === 1) {
      docKey = docKey[0]; // only one field, not multi-field
    } else { // more than one field in index
      // in the case where e.g. the user is searching {$gt: {a: 1}}
      // but the index is [a, b], then we need to shorten the doc key
      while (docKey.length > targetValue.length) {
        docKey.pop();
      }
    }
    //ABS as we just looking for values that don't match
    if (Math.abs(collate.collate(docKey, targetValue)) > 0) {
      // no need to filter any further; we're past the key
      break;
    }
  }
  return i > 0 ? rows.slice(i) : rows;
}

function reverseOptions(opts) {
  var newOpts = utils.clone(opts);
  delete newOpts.startkey;
  delete newOpts.endkey;
  delete newOpts.inclusive_start;
  delete newOpts.inclusive_end;

  if ('endkey' in opts) {
    newOpts.startkey = opts.endkey;
  }
  if ('startkey' in opts) {
    newOpts.endkey = opts.startkey;
  }
  if ('inclusive_start' in opts) {
    newOpts.inclusive_end = opts.inclusive_start;
  }
  if ('inclusive_end' in opts) {
    newOpts.inclusive_start = opts.inclusive_end;
  }
  return newOpts;
}

function validateIndex(index) {
  var ascFields = index.fields.filter(function (field) {
    return getValue(field) === 'asc';
  });
  if (ascFields.length !== 0 && ascFields.length !== index.fields.length) {
    throw new Error('unsupported mixed sorting');
  }
}

function validateFindRequest(requestDef) {
  if (typeof requestDef.selector !== 'object') {
    throw new Error('you must provide a selector when you find()');
  }
  // TODO: could be >1 field
  var selectorFields = Object.keys(requestDef.selector);
  var sortFields = requestDef.sort ?
    massageSort(requestDef.sort).map(getKey) : [];

  if (!utils.oneSetIsSubArrayOfOther(selectorFields, sortFields)) {
    throw new Error('conflicting sort and selector fields');
  }

  var selectors = requestDef.selector['$and'] || [requestDef.selector];
  for (var i = 0; i < selectors.length; i++) {
    var selector = selectors[i];
    var keys = Object.keys(selector);
    if (keys.length === 0) {
      throw new Error('invalid empty selector');
    }
    //var selection = selector[keys[0]];
    /*if (Object.keys(selection).length !== 1) {
      throw new Error('invalid selector: ' + JSON.stringify(selection) +
        ' - it must have exactly one key/value');
    }*/
  }
}

function parseField(fieldName) {
  // fields may be deep (e.g. "foo.bar.baz"), so parse
  var fields = [];
  var current = '';
  for (var i = 0, len = fieldName.length; i < len; i++) {
    var ch = fieldName[i];
    if (ch === '.') {
      if (i > 0 && fieldName[i - 1] === '\\') { // escaped delimiter
        current = current.substring(0, current.length - 1) + '.';
      } else { // not escaped, so delimiter
        fields.push(current);
        current = '';
      }
    } else { // normal character
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// determine the maximum number of fields
// we're going to need to query, e.g. if the user
// has selection ['a'] and sorting ['a', 'b'], then we
// need to use the longer of the two: ['a', 'b']
function getUserFields(selector, sort) {
  var selectorFields = Object.keys(selector);
  var sortFields = sort? sort.map(getKey) : [];
  var userFields;
  if (selectorFields.length > sortFields.length) {
    userFields = selectorFields;
  } else {
    userFields = sortFields;
  }

  if (sortFields.length === 0) {
    return {
      fields: userFields
    };
  }

  // sort according to the user's preferred sorting
  userFields = userFields.sort(function (left, right) {
    var leftIdx = sortFields.indexOf(left);
    if (leftIdx === -1) {
      leftIdx = Number.MAX_VALUE;
    }
    var rightIdx = sortFields.indexOf(right);
    if (rightIdx === -1) {
      rightIdx = Number.MAX_VALUE;
    }
    return leftIdx < rightIdx ? -1 : leftIdx > rightIdx ? 1 : 0;
  });

  return {
    fields: userFields,
    sortOrder: sort.map(getKey)
  };
}

module.exports = {
  getKey: getKey,
  getValue: getValue,
  massageSort: massageSort,
  massageSelector: massageSelector,
  validateIndex: validateIndex,
  validateFindRequest: validateFindRequest,
  reverseOptions: reverseOptions,
  filterInclusiveStart: filterInclusiveStart,
  massageIndexDef: massageIndexDef,
  parseField: parseField,
  getUserFields: getUserFields,
  isCombinationalField: isCombinationalField
};
