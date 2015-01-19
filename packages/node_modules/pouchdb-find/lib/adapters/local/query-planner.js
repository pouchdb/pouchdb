'use strict';

var localUtils = require('./local-utils');
var getKey = localUtils.getKey;
var getValue = localUtils.getValue;
//var getSize = localUtils.getSize;

function planQuery(selector, indexes) {
  var field = getKey(selector);
  var matcher = selector[field];
  if (typeof matcher === 'string') {
    matcher = {$eq: matcher};
  }
  var userOperator = getKey(matcher);
  var userValue = getValue(matcher);
  var queryOpts = {};

  var res = {field: field, queryOpts: queryOpts};

  indexes.forEach(function (index) {
    var indexField = getKey(index.def.fields[0]);
    if (indexField === field) {
      // found a good index
      res.index = index;

      if (index.def.fields.length > 1) {
        // user querying one field, but index has more than one
        switch (userOperator) {
          case '$eq':
            queryOpts.startkey = [userValue];
            queryOpts.endkey = [userValue, {}, {}];
            break;
          case '$lte':
            queryOpts.endkey = [userValue, {}, {}];
            break;
          case '$gte':
            queryOpts.startkey = [userValue];
            break;
          case '$lt':
            queryOpts.endkey = [userValue, {}, {}];
            queryOpts.inclusive_end = false;
            break;
          case '$gt':
            queryOpts.startkey = [userValue];
            queryOpts.inclusive_start = false;
            break;
        }
      } else { // 1 field in both query and index
        switch (userOperator) {
          case '$eq':
            queryOpts.key = userValue;
            break;
          case '$lte':
            queryOpts.endkey = userValue;
            break;
          case '$gte':
            queryOpts.startkey = userValue;
            break;
          case '$lt':
            queryOpts.endkey = userValue;
            queryOpts.inclusive_end = false;
            break;
          case '$gt':
            queryOpts.startkey = userValue;
            queryOpts.inclusive_start = false;
            break;
        }
      }
    }
  });

  return res;
}

module.exports = planQuery;