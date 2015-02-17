'use strict';

var utils = require('../../utils');
var collate = require('pouchdb-collate');

function getKey(obj) {
  return Object.keys(obj)[0];
}

function getValue(obj) {
  return obj[getKey(obj)];
}

function getSize(obj) {
  return Object.keys(obj).length;
}

// normalize the "sort" value
function massageSort(sort) {
  return sort && sort.map(function (sorting) {
    if (typeof sorting === 'string') {
      var obj = {};
      obj[sorting] = 'asc';
      return obj;
    } else {
      return sorting;
    }
  });
}

function massageSelector(selector) {
  var result = utils.clone(selector);
  if ('$and' in result) {
    result = utils.mergeObjects(result.$and);
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

// have to do this manually because REASONS. I don't know why
// CouchDB didn't implement inclusive_start
function filterInclusiveStart(rows, targetValue) {
  for (var i = 0, len = rows.length; i < len; i++) {
    var row = rows[i];
    if (collate.collate(row.key, targetValue) > 0) {
      if (i > 0) {
        return rows.slice(i);
      } else {
        return rows;
      }
    }
  }
  return rows;
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
  if ('sort' in requestDef && (!requestDef.sort || !Array.isArray(requestDef.sort))) {
    throw new Error('invalid sort json - should be an array');
  }
  // TODO: could be >1 field
  var selectorFields = Object.keys(requestDef.selector);
  var sortFields = requestDef.sort ?
    massageSort(requestDef.sort).map(getKey) : [];

  if (!utils.oneSetIsSubArrayOfOther(selectorFields, sortFields)) {
    throw new Error('conflicting sort and selector fields');
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
  if (current) {
    fields.push(current);
  }
  return fields;
}

module.exports = {
  getKey: getKey,
  getValue: getValue,
  getSize: getSize,
  massageSort: massageSort,
  massageSelector: massageSelector,
  validateIndex: validateIndex,
  validateFindRequest: validateFindRequest,
  reverseOptions: reverseOptions,
  filterInclusiveStart: filterInclusiveStart,
  massageIndexDef: massageIndexDef,
  parseField: parseField
};