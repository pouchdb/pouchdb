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
  matcher = {
    operator: getKey(matcher),
    value: getValue(matcher)
  };

  var res = {field: field, matcher: matcher};

  indexes.forEach(function (index) {
    var indexField = getKey(index.def.fields[0]);
    if (indexField === field) {
      res.index = index;
    }
  });

  return res;
}

module.exports = planQuery;