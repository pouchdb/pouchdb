'use strict';

//
// Do an in-memory filtering of rows that aren't covered by the index.
// E.g. if the user is asking for foo=1 and bar=2, but the index
// only covers "foo", then this in-memory filter would take care of
// "bar".
//

var collate = require('pouchdb-collate').collate;
var localUtils = require('../utils');
var getKey = localUtils.getKey;
var getValue = localUtils.getValue;
var parseField = localUtils.parseField;
var utils = require('../../../utils');

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

function createCriterion(userOperator, userValue, parsedField) {

  // compare the value of the field in the doc
  // to the user-supplied value, using the couchdb collation scheme
  function getDocFieldCollate(doc) {
    return collate(getFieldFromDoc(doc, parsedField), userValue);
  }

  function fieldExists(doc) {
    var docFieldValue = getFieldFromDoc(doc, parsedField);
    return typeof docFieldValue !== 'undefined' && docFieldValue !== null;
  }

  switch (userOperator) {
    case '$eq':
      return function (doc) {
        return fieldExists(doc) && getDocFieldCollate(doc) === 0;
      };
    case '$lte':
      return function (doc) {
        return fieldExists(doc) && getDocFieldCollate(doc) <= 0;
      };
    case '$gte':
      return function (doc) {
        return fieldExists(doc) && getDocFieldCollate(doc) >= 0;
      };
    case '$lt':
      return function (doc) {
        return fieldExists(doc) && getDocFieldCollate(doc) < 0;
      };
    case '$gt':
      return function (doc) {
        return fieldExists(doc) && getDocFieldCollate(doc) > 0;
      };
    case '$exists':
      return function (doc) {
        return fieldExists(doc);
      };
    case '$ne':
      return function (doc) {
        // might have to check multiple values, so I store this in an array
        var docFieldValue = getFieldFromDoc(doc, parsedField);
        return userValue.every(function (neValue) {
          return collate(docFieldValue, neValue) !== 0;
        });
      };
  }
}

function createFilterRowFunction(requestDef, inMemoryFields) {

  var criteria = [];
  inMemoryFields.forEach(function (field) {
    var matcher = requestDef.selector[field];
    var parsedField = parseField(field);

    if (!matcher) {
      // no filtering necessary; this field is just needed for sorting
      return;
    }

    Object.keys(matcher).forEach(function (userOperator) {
      var userValue = matcher[userOperator];

      var criterion = createCriterion(userOperator, userValue, parsedField);
      criteria.push(criterion);
    });
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

// create a comparator based on the sort object
function createFieldSorter(sort) {

  function getFieldValuesAsArray(doc) {
    return sort.map(function (sorting) {
      var fieldName = typeof sorting === 'string' ? sorting : getKey(sorting);
      var parsedField = parseField(fieldName);
      var docFieldValue = getFieldFromDoc(doc, parsedField);
      return docFieldValue;
    });
  }

  return function (aRow, bRow) {
    var aFieldValues = getFieldValuesAsArray(aRow.doc);
    var bFieldValues = getFieldValuesAsArray(bRow.doc);
    var collation = collate(aFieldValues, bFieldValues);
    if (collation !== 0) {
      return collation;
    }
    // this is what mango seems to do
    return utils.compare(aRow.doc._id, bRow.doc._id);
  };
}

// filter any fields not covered by the index
function filterInMemoryFields(rows, requestDef, inMemoryFields) {

  var filter = createFilterRowFunction(requestDef, inMemoryFields);
  rows =  rows.filter(filter);

  if (requestDef.sort) {
    // in-memory sort
    var fieldSorter = createFieldSorter(requestDef.sort);
    rows = rows.sort(fieldSorter);
    if (typeof requestDef.sort[0] !== 'string' &&
        getValue(requestDef.sort[0]) === 'desc') {
      rows = rows.reverse();
    }
  }

  if ('limit' in requestDef || 'skip' in requestDef) {
    // have to do the limit in-memory
    var skip = requestDef.skip || 0;
    var limit = ('limit' in requestDef ? requestDef.limit : rows.length) + skip;
    rows = rows.slice(skip, limit);
  }
  return rows;
}

module.exports = filterInMemoryFields;