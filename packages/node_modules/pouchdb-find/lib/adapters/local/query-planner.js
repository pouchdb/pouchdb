'use strict';

var localUtils = require('./local-utils');
var getKey = localUtils.getKey;
var getValue = localUtils.getValue;
var getSize = localUtils.getSize;

function planQuery(selector) {
  var field = Object.keys(selector)[0];
  var matcher = selector[field];
  if (typeof matcher === 'string') {
    matcher = {$eq: matcher};
  }
  matcher = {
    operator: getKey(matcher),
    value: getValue(matcher)
  };
  return [
    {field: field, matcher: matcher}
  ];
}

module.exports = planQuery;