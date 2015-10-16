'use strict';
/* jshint maxlen: false */
var rfcRegexp = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function makeUuids(count, length, radix) {
  count = count || 1;
  var i = -1;
  var out = [];
  while (++i < count) {
    out.push(PouchDB.utils.uuid(length, radix));
  }
  return out;
}

describe('test.uuid.js', function () {

  it('UUID RFC4122 test', function () {
    rfcRegexp.test(makeUuids()[0]).should
      .equal(true, 'Single UUID complies with RFC4122.');
    rfcRegexp.test(PouchDB.utils.uuid()).should
      .equal(true,
             'Single UUID through Pouch.utils.uuid complies with RFC4122.');
  });

  it('UUID generation uniqueness', function () {
    var count = 1000;
    var uuids = makeUuids(count);
    testUtils.eliminateDuplicates(uuids).should.have
      .length(count, 'Generated UUIDS are unique.');
  });

  it('Test small uuid uniqness', function () {
    var length = 8;
    var count = 2000;
    var uuids = makeUuids(count, length);
    testUtils.eliminateDuplicates(uuids).should.have
      .length(count, 'Generated small UUIDS are unique.');
  });

  it('Test custom length', function () {
    var length = 32;
    var count = 10;
    var uuids = makeUuids(count, length);
    // Test single UUID wrapper
    uuids.push(PouchDB.utils.uuid(length));
    uuids.map(function (uuid) {
      uuid.should.have.length(length, 'UUID length is correct.');
    });
  });

  it('Test custom length, redix', function () {
    var length = 32;
    var count = 10;
    var radix = 5;
    var uuids = makeUuids(count, length, radix);
    // Test single UUID wrapper
    uuids.push(PouchDB.utils.uuid(length, radix));
    uuids.map(function (uuid) {
      var nums = uuid.split('').map(function (character) {
          return parseInt(character, radix);
        });
      var max = Math.max.apply(Math, nums);
      var min = Math.min.apply(Math, nums);
      max.should.be.below(radix, 'Maximum character is less than radix');
      min.should.be.at.least(0, 'Min character is greater than or equal to 0');
    });
  });
});
