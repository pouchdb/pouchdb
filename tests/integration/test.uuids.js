'use strict';
/* jshint maxlen: false */
var rfcRegexp = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function makeUuids(count, length, radix) {
  count = count || 1;
  var i = -1;
  var out = [];
  while (++i < count) {
    out.push(testUtils.uuid(length, radix));
  }
  return out;
}

describe('test.uuid.js', function () {

  it('UUID RFC4122 test', function () {
    rfcRegexp.test(makeUuids()[0]).should
      .equal(true, 'Single UUID complies with RFC4122.');
    rfcRegexp.test(testUtils.uuid()).should
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

  it('_rev generation', function () {
    var _rev = testUtils.rev();

    _rev.should.match(/^[0-9a-fA-F]{32}$/);
  });
});
