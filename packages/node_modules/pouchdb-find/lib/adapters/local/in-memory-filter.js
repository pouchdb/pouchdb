'use strict';

//
// Do an in-memory filtering of rows that aren't covered by the index.
// E.g. if the user is asking for foo=1 and bar=2, but the index
// only covers "foo", then this in-memory filter would take care of
// "bar".
//

var localUtils = require('./local-utils');
var getKey = localUtils.getKey;
var getValue = localUtils.getValue;
var collate = require('pouchdb-collate').collate;
var parseField = require('./parse-field');

// this would just be "return doc[field]", but fields
// can be "deep" due to dot notation
function getFieldFromDoc(doc, parsedField) {
  var value = doc;
  for (var i = 0, len = parsedField.length; i < len; i++) {
    var key = parsedField[i];
    value = value[key];
    if (!value) {
      break;
    }
  }
  return value;
}

function createFilterRowFunction(requestDef, inMemoryFields) {

  var criteria = inMemoryFields.map(function (field) {
    var matcher = requestDef.selector[field];
    var parsedField = parseField(field);

    var userOperator = getKey(matcher);
    var userValue = getValue(matcher);

    // compare the value of the field in the doc
    // to the user-supplied value, using the couchdb collation scheme
    function getDocFieldCollate(doc) {
      return collate(getFieldFromDoc(doc, parsedField), userValue);
    }

    switch (userOperator) {
      case '$eq':
        return function (doc) {
          return getDocFieldCollate(doc) === 0;
        };
      case '$lte':
        return function (doc) {
          return getDocFieldCollate(doc) <= 0;
        };
      case '$gte':
        return function (doc) {
          return getDocFieldCollate(doc) >= 0;
        };
      case '$lt':
        return function (doc) {
          return getDocFieldCollate(doc) < 0;
        };
      case '$gt':
        return function (doc) {
          return getDocFieldCollate(doc) > 0;
        };
      case '$exists':
        return function (doc) {
          var docFieldValue = getFieldFromDoc(doc, parsedField);
          return typeof docFieldValue !== 'undefined' && docFieldValue !== null;
        };
      case '$ne':
        return function (doc) {
          return getDocFieldCollate(doc) !== 0;
        };
    }
  });

  return function filterRowFunction(row) {
    for (var i = 0, len = criteria.length; i < len; i++) {
      var criterion = criteria[i];
      if (!criterion(row.doc)) {
        return false;
      }
    }
    return true;
  };
}

// filter any fields not covered by the index
function filterInMemoryFields(rows, requestDef, inMemoryFields) {

  var filter = createFilterRowFunction(requestDef, inMemoryFields);
  return rows.filter(filter);
}

module.exports = filterInMemoryFields;