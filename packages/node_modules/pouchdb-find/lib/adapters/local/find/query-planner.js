'use strict';

var utils = require('../../../utils');
var log = utils.log;
var localUtils = require('../utils');
var getKey = localUtils.getKey;
var massageSort = localUtils.massageSort;

// couchdb lowest collation value
var COLLATE_LO = null;

// couchdb highest collation value (TODO: well not really, but close enough amirite)
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

// so when you do e.g. $eq/$eq, we can do it entirely in the database.
// but when you do e.g. $gt/$eq, the first part can be done
// in the database, but the second part has to be done in-memory,
// because $gt has forced us to lose precision.
// so that's what this determines
function userOperatorLosesPrecision(selector, field) {
  var matcher = selector[field];
  var userOperator = getKey(matcher);

  return userOperator !== '$eq';
}

// sort the user fields by their position in the index,
// if they're in the index
function sortFieldsByIndex(userFields, index) {
  var indexFields = index.def.fields.map(getKey);

  return userFields.slice().sort(function (a, b) {
    var aIdx = indexFields.indexOf(a);
    var bIdx = indexFields.indexOf(b);
    if (aIdx === -1) {
      aIdx = Number.MAX_VALUE;
    }
    if (bIdx === -1) {
      bIdx = Number.MAX_VALUE;
    }
    return utils.compare(aIdx, bIdx);
  });
}

// first pass to try to find fields that will need to be sorted in-memory
function getBasicInMemoryFields(index, selector, userFields) {

  userFields = sortFieldsByIndex(userFields, index);

  // check if any of the user selectors lose precision
  var needToFilterInMemory = false;
  for (var i = 0, len = userFields.length; i < len; i++) {
    var field = userFields[i];
    if (needToFilterInMemory || !checkFieldInIndex(index, field)) {
      return userFields.slice(i);
    }
    if (i < len - 1 && userOperatorLosesPrecision(selector, field)) {
      needToFilterInMemory = true;
    }
  }
  return [];
}

// get any fields that will need to be filtered in-memory
// (i.e. because they aren't covered by the index)
function getInMemoryFields(index, selector, userFields) {

  var inMemoryFields = getBasicInMemoryFields(index, selector, userFields);

  // now check for any $ne fields at any position, because those will have to be
  // filtered in-memory no matter what
  Object.keys(selector).forEach(function (field) {
    var matcher = selector[field];
    if ('$ne' in matcher && inMemoryFields.indexOf(field) === -1) {
      inMemoryFields.push(field);
    }
  });
  return inMemoryFields;
}

// check that at least one field in the user's query is represented
// in the index. order matters in the case of sorts
function checkIndexFieldsMatch(indexFields, sortOrder, fields) {
  if (sortOrder) {
    // array has to be a strict subarray of index array. furthermore,
    // the sortOrder fields need to all be represented in the index
    var sortMatches = utils.oneArrayIsStrictSubArrayOfOther(sortOrder, indexFields);
    var selectorMatches = utils.oneArrayIsSubArrayOfOther(fields, indexFields);

    return sortMatches && selectorMatches;
  }

  // all of the user's specified fields still need to be
  // on the left side of the index array, although the order
  // doesn't matter
  return utils.oneSetIsSubArrayOfOther(fields, indexFields);
}

// check all the index fields for usages of '$ne'
// e.g. if the user queries {foo: {$ne: 'foo'}, bar: {$eq: 'bar'}},
// then we can neither use an index on ['foo'] nor an index on
// ['foo', 'bar'], but we can use an index on ['bar'] or ['bar', 'foo']
function checkFieldsLogicallySound(indexFields, selector) {
  var firstField = indexFields[0];
  var matcher = selector[firstField];

  var isInvalidNe = Object.keys(matcher).length === 1 &&
    getKey(matcher) === '$ne';

  return !isInvalidNe;
}

function checkIndexMatches(index, sortOrder, fields, selector) {

  var indexFields = index.def.fields.map(getKey);

  var fieldsMatch = checkIndexFieldsMatch(indexFields, sortOrder, fields);

  if (!fieldsMatch) {
    return false;
  }

  var logicallySound = checkFieldsLogicallySound(indexFields, selector);

  return logicallySound;
}

//
// the algorithm is very simple:
// take all the fields the user supplies, and if those fields
// are a strict subset of the fields in some index,
// then use that index
//
//
function findMatchingIndexes(selector, userFields, sortOrder, indexes) {

  var res = [];
  for (var i = 0, iLen = indexes.length; i < iLen; i++) {
    var index = indexes[i];
    var indexMatches = checkIndexMatches(index, sortOrder, userFields, selector);
    if (indexMatches) {
      res.push(index);
    }
  }
  return res;
}

// find the best index, i.e. the one that matches the most fields
// in the user's query
function findBestMatchingIndex(selector, userFields, sortOrder, indexes) {

  var matchingIndexes = findMatchingIndexes(selector, userFields, sortOrder, indexes);

  if (matchingIndexes.length === 0) {
    return null;
  }
  if (matchingIndexes.length === 1) {
    return matchingIndexes[0];
  }

  var userFieldsMap = utils.arrayToObject(userFields);

  function scoreIndex(index) {
    var indexFields = index.def.fields.map(getKey);
    var score = 0;
    for (var i = 0, len = indexFields.length; i < len; i++) {
      var indexField = indexFields[i];
      if (userFieldsMap[indexField]) {
        score++;
      }
    }
    return score;
  }

  return utils.max(matchingIndexes, scoreIndex);
}

function getSingleFieldQueryOptsFor(userOperator, userValue) {
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

function getSingleFieldQueryOpts(selector, index) {
  var field = getKey(index.def.fields[0]);
  var matcher = selector[field];

  var userOperators = Object.keys(matcher);

  var combinedOpts;

  for (var i = 0; i < userOperators.length; i++) {
    var userOperator = userOperators[i];
    var userValue = matcher[userOperator];

    var newQueryOpts = getSingleFieldQueryOptsFor(userOperator, userValue);
    if (combinedOpts) {
      combinedOpts = utils.mergeObjects([combinedOpts, newQueryOpts]);
    } else {
      combinedOpts = newQueryOpts;
    }
  }
  return combinedOpts;
}

function getMultiFieldQueryOptsFor(userOperator, userValue) {
  switch (userOperator) {
    case '$eq':
      return {
        startkey: userValue,
        endkey: userValue
      };
    case '$lte':
      return {
        endkey: userValue
      };
    case '$gte':
      return {
        startkey: userValue
      };
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
          startkey: COLLATE_LO_PLUS_1,
          endkey: COLLATE_HI
        };
      } else {
        return {
          startkey: COLLATE_LO,
          endkey: COLLATE_LO
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

    if (!matcher || getKey(matcher) === '$ne') {
      // fewer fields in user query than in index, or unusable $ne field
      if (inclusiveStart !== false) {
        startkey.push(COLLATE_LO);
      }
      if (inclusiveEnd !== false) {
        endkey.push(COLLATE_HI);
      }
      continue;
    }

    var userOperators = Object.keys(matcher);

    var combinedOpts = null;

    for (var j = 0; j < userOperators.length; j++) {
      var userOperator = userOperators[j];
      var userValue = matcher[userOperator];

      var newOpts = getMultiFieldQueryOptsFor(userOperator, userValue);

      if (combinedOpts) {
        combinedOpts = utils.mergeObjects([combinedOpts, newOpts]);
      } else {
        combinedOpts = newOpts;
      }
    }

    startkey.push('startkey' in combinedOpts ? combinedOpts.startkey : COLLATE_LO);
    endkey.push('endkey' in combinedOpts ? combinedOpts.endkey : COLLATE_HI);
    if ('inclusive_start' in combinedOpts) {
      inclusiveStart = combinedOpts.inclusive_start;
    }
    if ('inclusive_end' in combinedOpts) {
      inclusiveEnd = combinedOpts.inclusive_end;
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

function noIndexFoundError(userFields) {
  var message = 'couldn\'t find a usable index. try creating an index on: ' +
      userFields.join(', ');
  return new Error(message);
}

function planQuery(request, indexes) {

  log('planning query', request);

  var selector = request.selector;
  var sort = massageSort(request.sort);

  var userFieldsRes = getUserFields(selector, sort);

  var userFields = userFieldsRes.fields;
  var sortOrder = userFieldsRes.sortOrder;
  var index = findBestMatchingIndex(selector, userFields, sortOrder, indexes);

  if (!index) {
    throw noIndexFoundError(userFields);
  }

  var firstIndexField = index.def.fields[0];
  var firstMatcher = selector[getKey(firstIndexField)];
  if (Object.keys(firstMatcher).length === 1 && getKey(firstMatcher) === '$ne') {
    throw new Error('$ne can\'t be used here. try $gt/$lt instead');
  }

  var queryOpts = getQueryOpts(selector, index);

  var inMemoryFields = getInMemoryFields(index, selector, userFields);

  var res = {
    queryOpts: queryOpts,
    index: index,
    inMemoryFields: inMemoryFields
  };
  log('query plan', res);
  return res;
}

module.exports = planQuery;