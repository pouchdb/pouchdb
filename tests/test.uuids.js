'use strict';
var rfcRegexp = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

describe('test.uuid.jsu', function () {

  it('UUID generation count', function () {
    var count = 10;
    PouchDB.utils.uuids(count).should.have
      .length(count, 'Correct number of uuids generated.');
  });

  it('UUID RFC4122 test', function () {
    rfcRegexp.test(PouchDB.utils.uuids()[0]).should
      .equal(true, 'Single UUID complies with RFC4122.');
    rfcRegexp.test(PouchDB.utils.uuid()).should
      .equal(true, 'Single UUID through Pouch.utils.uuid complies with RFC4122.');
  });

  it('UUID generation uniqueness', function () {
    var count = 1000;
    var uuids = PouchDB.utils.uuids(count);
    testUtils.eliminateDuplicates(uuids).should.have
      .length(count, 'Generated UUIDS are unique.');
  });

  it('Test small uuid uniqness', function () {
    var length = 8;
    var count = 2000;
    var uuids = PouchDB.utils.uuids(count, { length: length });
    testUtils.eliminateDuplicates(uuids).should.have
      .length(count, 'Generated small UUIDS are unique.');
  });

  it('Test custom length', function () {
    var length = 32;
    var count = 10;
    var options = { length: length };
    var uuids = PouchDB.utils.uuids(count, options);
    // Test single UUID wrapper
    uuids.push(PouchDB.utils.uuid(options));
    uuids.map(function (uuid) {
      uuid.should.have.length(length, 'UUID length is correct.');
    });
  });

  it('Test custom length, redix', function () {
    var length = 32;
    var count = 10;
    var radix = 5;
    var options = {
        length: length,
        radix: radix
      };
    var uuids = PouchDB.utils.uuids(count, options);
    // Test single UUID wrapper
    uuids.push(PouchDB.utils.uuid(options));
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
