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

test('UUID generation count', 1, function() {
  var count = 10;

  equal(Pouch.uuids(count).length, count, "Correct number of uuids generated.");
});

test('UUID generation uniqueness', 1, function() {
  var count = 1000;
  var uuids = Pouch.uuids(count);

  equal($.unique(uuids).length, count, "Generated UUIDS are unique.");
});

test('UUID seeded generation uniqueness', 1, function() {
  var count = 1000;
  var uuids = Pouch.uuids(count, 0.4);

  equal($.unique(uuids).length, count, "Generated UUIDS are unique.");
});

test('UUID generator seed argument parsing', 4, function() {
  var count = 10;

  equal(Pouch.uuids().length, 1, "No argument.");
  equal(Pouch.uuids(count).length, count, "Only count as argument");
  equal(Pouch.uuids(0.4).length, 1, "Only seed as argument.");
  equal(Pouch.uuids(count, 0.4).length, count, "Both count and seed as argument.");
});
