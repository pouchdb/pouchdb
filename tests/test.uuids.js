/*globals $, utils: true */

"use strict";

var qunit = module;

if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

var uuidMethods = [
  null,      // The default
  '',        // Math.uuid
  'Fast',    // Math.uuidFast
  'Compact'  // Math.uuidCompact
];

var rfcRegexp = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

uuidMethods.map(function(method) {
  test('UUID generation count', 1, function() {
    var count = 10;

    equal(Pouch.uuids(count, {method: method}).length, count,
          "Correct number of uuids generated.");
  });

  test('UUID RFC4122 test', 1, function() {
    var uuid = Pouch.uuids(1, {method: method})[0];
    equal(rfcRegexp.test(uuid), true, "UUID complies with RFC4122.");
  });

  test('UUID generation uniqueness', 1, function() {
    var count = 5000;
    var uuids = Pouch.uuids(count, {method: method});

    equal($.unique(uuids).length, count, "Generated UUIDS are unique.");
  });
});
