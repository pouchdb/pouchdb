'use strict';

// couchdb lowest collation value
var COLLATE_LO = null;

// couchdb highest collation value (TODO: well not really, but close)
var COLLATE_HI = {"\uffff": {}};

// couchdb second-lowest collation value
var COLLATE_LO_PLUS_1 = false;

var COLLATE_NULL_LO = null;
var COLLATE_NULL_HI = null;
var COLLATE_BOOL_LO = false;
var COLLATE_BOOL_HI = true;
var COLLATE_NUM_LO = 0;
var COLLATE_NUM_HI = Number.MAX_VALUE;
var COLLATE_STR_LO = '';
var COLLATE_STR_HI = '\uffff\uffff\uffff'; // TODO: yah I know
var COLLATE_ARR_LO = [];
var COLLATE_ARR_HI = [{'\uffff': {}}]; // TODO: yah I know
var COLLATE_OBJ_LO = {};
var COLLATE_OBJ_HI = {'\uffff': {}}; // TODO: yah I know

var utils = require('../../utils');
var log = utils.log;
var localUtils = require('./local-utils');
var getKey = localUtils.getKey;
var getValue = localUtils.getValue;
var massageSort = localUtils.massageSort;

//
// normalize the selector
//
function massageSelector(selector) {
  selector = utils.clone(selector);
  var fields = Object.keys(selector);

  fields.forEach(function (field) {
    var matcher = selector[field];

    if (typeof matcher === 'string') {
      matcher = {$eq: matcher};
    }
    selector[field] = matcher;
  });

  return selector;
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
      fields: userFields,
      orderMatters: false
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
    orderMatters: true
  };
}

function checkFieldInIndex(index, field) {
  var indexFields = index.def.fields.map(getKey);
  for (var i = 0, len = indexFields.length; i < len; i++) {
    var indexField = indexFields[i];
    if (field === indexField) {
      return true;
    }
  }
  return false;
}

function checkIndexMatches(index, orderMatters, fields) {
  for (var i = 0, len = fields.length; i < len; i++) {
    var field = fields[i];
    var fieldInIndex = checkFieldInIndex(index, field);
    if (!fieldInIndex) {
      return false;
    }
  }

  var indexFields = index.def.fields.map(getKey);

  if (orderMatters) {
    // array has to be a strict subset of index array
    return utils.oneArrayIsSubArrayOfOther(fields, indexFields);
  } else {
    // all of the user's specified fields still need to be
    // on the left of the index array
    return utils.oneSetIsSubArrayOfOther(fields, indexFields);
  }
}

//
// the algorithm is very simple:
// take all the fields the user supplies, and if those fields
// are a strict subset of the fields in some index,
// then use that index
//
function findMatchingIndex(userFields, orderMatters, indexes) {

  for (var i = 0, iLen = indexes.length; i < iLen; i++) {
    var index = indexes[i];
    var indexMatches = checkIndexMatches(index, orderMatters, userFields);
    if (indexMatches) {
      return index;
    }
  }
  return null;
}

function getSingleFieldQueryOpts(selector, index) {
  var field = getKey(index.def.fields[0]);
  var matcher = selector[field];
  var userOperator = getKey(matcher);
  var userValue = getValue(matcher);

  switch (userOperator) {
    case '$eq':
      return {key: userValue};
    case '$lte':
      return {endkey: userValue};
    case '$gte':
      return {startkey: userValue};
    case '$lt':
      return {
        endkey: userValue,
        inclusive_end: false
      };
    case '$gt':
      return {
        startkey: userValue,
        inclusive_start: false
      };
    case '$exists':
      if (userValue) {
        return {
          startkey: COLLATE_LO_PLUS_1
        };
      }
      return {
        endkey: COLLATE_LO
      };
    // cloudant docs: Valid values are “null”, “boolean”, “number”, “string”,
    // “array”, and “object”.
    case '$type':
      switch (userValue) {
        case 'null':
          return {
            startkey: COLLATE_NULL_LO,
            endkey: COLLATE_NULL_HI
          };
        case 'boolean':
          return {
            startkey: COLLATE_BOOL_LO,
            endkey: COLLATE_BOOL_HI
          };
        case 'number':
          return {
            startkey: COLLATE_NUM_LO,
            endkey: COLLATE_NUM_HI
          };
        case 'string':
          return {
            startkey: COLLATE_STR_LO,
            endkey: COLLATE_STR_HI
          };
        case 'array':
          return {
            startkey: COLLATE_ARR_LO,
            endkey: COLLATE_ARR_HI
          };
        case 'object':
          return {
            startkey: COLLATE_OBJ_LO,
            endkey: COLLATE_OBJ_HI
          };
      }
  }
}

function getMultiFieldQueryOpts(selector, index) {

  var indexFields = index.def.fields.map(getKey);

  var startkey = [];
  var endkey = [];
  var inclusiveStart;
  var inclusiveEnd;

  for (var i = 0, len = indexFields.length; i < len; i++) {
    var indexField = indexFields[i];

    var matcher = selector[indexField];

    if (!matcher) {
      // fewer fields in user query than in index
      startkey.push(COLLATE_LO);
      endkey.push(COLLATE_HI);
      continue;
    }

    var userOperator = getKey(matcher);
    var userValue = getValue(matcher);

    switch (userOperator) {
      case '$eq':
        startkey.push(userValue);
        endkey.push(userValue);
        break;
      case '$lte':
        startkey.push(COLLATE_LO);
        endkey.push(userValue);
        break;
      case '$gte':
        startkey.push(userValue);
        endkey.push(COLLATE_HI);
        break;
      case '$lt':
        startkey.push(COLLATE_LO);
        endkey.push(userValue);
        inclusiveEnd = false;
        break;
      case '$gt':
        startkey.push(userValue);
        endkey.push(COLLATE_HI);
        inclusiveStart = false;
        break;
      case '$exists':
        if (userValue) {
          startkey.push(COLLATE_LO_PLUS_1);
          endkey.push(COLLATE_HI);
        } else {
          startkey.push(COLLATE_LO);
          endkey.push(COLLATE_LO);
        }
        break;
    }
  }

  var res = {
    startkey: startkey,
    endkey: endkey
  };

  if (typeof inclusiveStart !== 'undefined') {
    res.inclusive_start = inclusiveStart;
  }
  if (typeof inclusiveEnd !== 'undefined') {
    res.inclusive_end = inclusiveEnd;
  }

  return res;
}

function getQueryOpts(selector, index) {
  if (index.def.fields.length === 1) {
    // one field in index, so the value was indexed as a singleton
    return getSingleFieldQueryOpts(selector, index);
  }
  // else index has multiple fields, so the value was indexed as an array
  return getMultiFieldQueryOpts(selector, index);
}

function planQuery(request, indexes) {

  log('planning query', request);

  var selector = massageSelector(request.selector);
  var sort = massageSort(request.sort);

  var userFieldsRes = getUserFields(selector, sort);

  var userFields = userFieldsRes.fields;
  var orderMatters = userFieldsRes.orderMatters;
  var index = findMatchingIndex(userFields, orderMatters, indexes);

  if (!index) {
    throw new Error('couldn\'t find any index to use');
  }

  var queryOpts = getQueryOpts(selector, index);

  var res = {
    queryOpts: queryOpts,
    index: index
  };
  log('query plan', res);
  return res;
}

module.exports = planQuery;