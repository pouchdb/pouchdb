'use strict';

var COLLATE_LO = null; // couchdb lowest collation value
var COLLATE_HI = {};   // couchdb highest collation value (TODO: not really)

var utils = require('../../utils');
var log = utils.log;
var localUtils = require('./local-utils');
var getKey = localUtils.getKey;
var getValue = localUtils.getValue;
//var getSize = localUtils.getSize;

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

function checkIndexMatches(index, fields) {
  for (var i = 0, len = fields.length; i < len; i++) {
    var field = fields[i];
    var fieldInIndex = checkFieldInIndex(index, field);
    if (!fieldInIndex) {
      return false;
    }
  }
  return true;
}

//
// the algorithm is very simple:
// take all the fields the user supplies, and if those fields
// are a strict subset of the fields in some index,
// then use that index
//
function findMatchingIndex(selector, indexes) {
  var fields = Object.keys(selector);

  for (var i = 0, iLen = indexes.length; i < iLen; i++) {
    var index = indexes[i];
    var indexMatches = checkIndexMatches(index, fields);
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

function planQuery(origSelector, indexes) {

  log('planning query', origSelector);

  var selector = massageSelector(origSelector);

  var index = findMatchingIndex(selector, indexes);

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