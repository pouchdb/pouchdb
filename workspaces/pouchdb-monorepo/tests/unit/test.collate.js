'use strict';

var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
var should = require('chai').should();
var pouchCollate = PouchDB.collate;
var collate = pouchCollate.collate;
var normalizeKey = pouchCollate.normalizeKey;
var toIndexableString = pouchCollate.toIndexableString;
var parseIndexableString = pouchCollate.parseIndexableString;

function stringLexCompare(a, b) {

  var aLen = a.length;
  var bLen = b.length;

  var i;
  for (i = 0; i < aLen; i++) {
    if (i === bLen) {
      // b is shorter substring of a
      return 1;
    }
    var aChar = a.charAt(i);
    var bChar = b.charAt(i);
    if (aChar !== bChar) {
      return aChar < bChar ? -1 : 1;
    }
  }

  if (aLen < bLen) {
    // a is shorter substring of b
    return -1;
  }

  return 0;
}

/*
 * returns the decimal form for the given integer, i.e. writes
 * out all the digits (in base-10) instead of using scientific notation
 */
function intToDecimalForm(int) {

  var isNeg = int < 0;
  var result = '';

  do {
    var remainder = isNeg ? -Math.ceil(int % 10) : Math.floor(int % 10);

    result = remainder + result;
    int = isNeg ? Math.ceil(int / 10) : Math.floor(int / 10);
  } while (int);


  if (isNeg && result !== '0') {
    result = '-' + result;
  }

  return result;
}

var verifyLexicalKeysSort = function (keys) {
  var lexical = keys.map(function (key) {
    return [key, pouchCollate.toIndexableString(key)];
  });
  lexical.sort(function (a, b) {
    return stringLexCompare(a[1], b[1]);
  });
  keys.sort(pouchCollate.collate);

  keys.forEach(function (expected, i) {
    var actual = lexical[i][0];

    should.equal(actual, expected, 'expect ' + JSON.stringify(actual) +
      ' is ' + JSON.stringify(expected));
  });
};


describe('test.collate.js', function () {
  var a = {
    array: [1, 2, 3],
    bool: true,
    string: '123',
    object: {
      a: 3,
      b: 2
    },
    number: 1
  };
  var b = {
    array: ['a', 'b'],
    bool: false,
    string: 'ab',
    object: {
      c: 1,
      b: 3
    },
    number: 2
  };
  var c = {
    object: {
      a: 1,
      b: 2,
      c: 3
    },
    array: [1, 2]
  };
  it('compare array to itself', function () {
    collate(a.array, a.array).should.equal(0);
    collate(b.array, b.array).should.equal(0);
    collate(c.array, c.array).should.equal(0);
  });
  it('compare boolean to itself', function () {
    collate(a.bool, a.bool).should.equal(0);
    collate(b.bool, b.bool).should.equal(0);
  });
  it('compare string to itself', function () {
    collate(a.string, a.string).should.equal(0);
    collate(b.string, b.string).should.equal(0);
  });
  it('compare number to itself', function () {
    collate(a.number, a.number).should.equal(0);
    collate(b.number, b.number).should.equal(0);
  });
  it('compare null to itself', function () {
    collate(null, null).should.equal(0);
  });
  it('compare object to itself', function () {
    collate(a.object, a.object).should.equal(0);
    collate(b.object, b.object).should.equal(0);
    collate(c.object, c.object).should.equal(0);
  });
  it('compare array to array', function () {
    collate(a.array, b.array).should.equal(-1);
    collate(b.array, a.array).should.equal(1);
    collate(c.array, b.array).should.equal(-1);
    collate(b.array, c.array).should.equal(1);
    collate(a.array, c.array).should.equal(1);
    collate(c.array, a.array).should.equal(-1);
  });
  it('compare array to array', function () {
    collate([a.array], [b.array]).should.equal(-1);
    collate([b.array], [a.array]).should.equal(1);
  });
  it('compare boolean to boolean', function () {
    collate(a.bool, b.bool).should.equal(1);
    collate(b.bool, a.bool).should.equal(-1);
  });
  it('compare string to string', function () {
    collate(a.string, b.string).should.equal(-1);
    collate(b.string, a.string).should.equal(1);
  });
  it('compare number to number', function () {
    collate(a.number, b.number).should.equal(-1);
    collate(b.number, a.number).should.equal(1);
  });
  it('compare object to object', function () {
    collate(a.object, b.object).should.equal(-1);
    collate(b.object, a.object).should.equal(1);
    collate(c.object, b.object).should.equal(-1);
    collate(b.object, c.object).should.equal(1);
    collate(c.object, a.object).should.be.below(0);
    collate(a.object, c.object).should.be.above(0);
  });
  it('objects differing only in num of keys', function () {
    collate({1: 1}, {1: 1, 2: 2}).should.equal(-1);
    collate({1: 1, 2: 2}, {1: 1}).should.equal(1);
  });
  it('compare number to null', function () {
    collate(a.number, null).should.be.above(0);
  });
  it('compare number to function', function () {
    collate(a.number, function () {
    }).should.not.equal(collate(a.number, function () {}));
    collate(b.number, function () {
    }).should.not.equal(collate(b.number, function () {}));
    collate(function () {
    }, a.number).should.not.equal(collate(function () {}, a.number));
    collate(function () {
    }, b.number).should.not.equal(collate(function () {}, b.number));
  });

});

describe('normalizeKey', function () {

  it('verify key normalizations', function () {
    var normalizations = [
      [null, null],
      [NaN, null],
      [undefined, null],
      [Infinity, null],
      [-Infinity, null],
      ['', ''],
      ['foo', 'foo'],
      ['0', '0'],
      ['1', '1'],
      [0, 0],
      [1, 1],
      [Number.MAX_VALUE, Number.MAX_VALUE],
      [new Date('1982-11-30T00:00:00.000Z'), '1982-11-30T00:00:00.000Z'] // Thriller release date
    ];

    normalizations.forEach(function (normalization) {
      var original = normalization[0];
      var expected = normalization[1];
      var normalized = normalizeKey(original);

      var message = 'check normalization of ' + JSON.stringify(original) +
        ' to ' + JSON.stringify(expected) +
        ', got ' + JSON.stringify(normalized);
      should.equal(normalized, expected, message);
    });
  });
});

describe('indexableString', function () {

  it('verify intToDecimalForm', function () {
    intToDecimalForm(0).should.equal('0');
    intToDecimalForm(Number.MIN_VALUE).should.equal('0');
    intToDecimalForm(-Number.MIN_VALUE).should.equal('0');

    var maxValueStr = '1797693134862316800886484642206468426866682428440286464' +
      '42228680066046004606080400844208228060084840044686866242482868202680268' +
      '82040288406280040662242886466688240606642242682208668042640440204020242' +
      '48802248082808208888442866208026644060866608420408868240026826626668642' +
      '46642840408646468824200860804260804068888';

    intToDecimalForm(Number.MAX_VALUE).should.equal(maxValueStr);
    intToDecimalForm(-Number.MAX_VALUE).should.equal('-' + maxValueStr);

    var simpleNums = [-3000, 3000, 322, 2308, -32, -1, 0, 1, 2, -2, -10, 10, -100, 100];

    simpleNums.forEach(function (simpleNum) {
      intToDecimalForm(simpleNum).should.equal(simpleNum.toString());
    });
  });

  it('verify toIndexableString()', function () {
    var keys = [
      null,
      false,
      true,
      -Number.MAX_VALUE,
      -300,
      -200,
      -100,
      -10,
      -2.5,
      -2,
      -1.5,
      -1,
      -0.5,
      -0.0001,
      -Number.MIN_VALUE,
      0,
      Number.MIN_VALUE,
      0.0001,
      0.1,
      0.5,
      1,
      1.5,
      2,
      3,
      10,
      15,
      100,
      200,
      300,
      Number.MAX_VALUE,
      '',
      '1',
      '10',
      '100',
      '2',
      '20',
      '[]',
      //'é',
      'foo',
      'mo',
      'moe',
      //'moé',
      //'moët et chandon',
      'moz',
      'mozilla',
      'mozilla with a super long string see how far it can go',
      'mozzy',
      [],
      [ null ],
      [ null, null ],
      [ null, 'foo' ],
      [ false ],
      [ false, 100 ],
      [ true ],
      [ true, 100 ],
      [ 0 ],
      [ 0, null ],
      [ 0, 1 ],
      [ 0, '' ],
      [ 0, 'foo' ],
      [ '', '' ],
      [ 'foo' ],
      [ 'foo', 1 ],
      {},
      { '0': null },
      { '0': false },
      { '0': true },
      { '0': 0 },
      { '0': 1 },
      { '0': 'bar' },
      { '0': 'foo' },
      { '0': 'foo', '1': false },
      { '0': 'foo', '1': true },
      { '0': 'foo', '1': 0 },
      { '0': 'foo', '1': '0' },
      { '0': 'foo', '1': 'bar' },
      { '0': 'quux' },
      { '1': 'foo' }
      //{ '1': 'foo', '0' : 'foo' } // key order actually matters, but node sorts them
    ];
    verifyLexicalKeysSort(keys);
  });

  it('verify toIndexableString()', function () {
    var keys = [
      ['test', 'test'],
      ['test\u0000']
    ];
    verifyLexicalKeysSort(keys);
  });

  it('verify deep normalization', function () {
    var a = {
      list : [undefined, '1982-11-30T00:00:00.000Z'],
      obj : {
        foo: null,
        date: '1982-11-30T00:00:00.000Z'
      },
      brokenList : [undefined, 1, 2, undefined, 3, 4, 5, undefined]
    };
    var b = {
      list : [null, new Date('1982-11-30T00:00:00.000Z')],
      obj : {
        foo: NaN,
        date: new Date('1982-11-30T00:00:00.000Z')
      },
      ignoredParam : undefined,
      brokenList : [null, 1, 2, null, 3, 4, 5, null]
    };

    // sanity check
    JSON.stringify(a).should.equal(JSON.stringify(b), 'stringify a,b');

    toIndexableString(a).should.equal(toIndexableString(b), 'string a,b');
    toIndexableString(a).should.equal(toIndexableString(b), 'string a,a');
    toIndexableString(b).should.equal(toIndexableString(b), 'string b,b');

    normalizeKey(a).should.deep.equal(normalizeKey(b), 'normalize a,b');
    normalizeKey(a).should.deep.equal(normalizeKey(a), 'normalize a,a');
    normalizeKey(b).should.deep.equal(normalizeKey(b), 'normalize b,b');

    collate(a, b).should.equal(0, 'collate a,b');
    collate(a, a).should.equal(0, 'collate a,a');
    collate(b, b).should.equal(0, 'collate b,b');
  });

  it('verify parseIndexableString', function () {
    var keys = [null, false, true, 0, 1, -1, 9, -9, 10, -10, 0.1, -0.1, -0.01,
      100, 200, 20, -20, -200, -30, Number.MAX_VALUE, Number.MIN_VALUE,
      'foo', '', '\u0000', '\u0001', '\u0002', [1], {foo: true},
      {foo: 'bar', 'baz': 'quux', foobaz: {bar: 'bar', baz: 'baz', quux: {foo: 'bar'}}},
      {foo: {bar: true}},
      [{foo: 'bar'}, {bar: 'baz'}, {}, ['foo', 'bar', 'baz']],
      [[[['foo']], [], [['bar']]]],
      -Number.MAX_VALUE,
      -300,
      -200,
      -100,
      -10,
      -2.5,
      -2,
      -1.5,
      -1,
      -0.5,
      -0.0001,
      -Number.MIN_VALUE,
      0,
      Number.MIN_VALUE,
      0.0001,
      0.1,
      0.5,
      1,
      1.5,
      2,
      3,
      10,
      15,
      100,
      200,
      300,
      Number.MAX_VALUE,
      '',
      '1',
      '10',
      '100',
      '2',
      '20',
      '[]',
      //'é',
      'foo',
      'mo',
      'moe',
      //'moé',
      //'moët et chandon',
      'moz',
      'mozilla',
      'mozilla with a super long string see how far it can go',
      'mozzy',
      [],
      [ null ],
      [ null, null ],
      [ null, 'foo' ],
      [ false ],
      [ false, 100 ],
      [ true ],
      [ true, 100 ],
      [ 0 ],
      [ 0, null ],
      [ 0, 1 ],
      [ 0, '' ],
      [ 0, 'foo' ],
      [ '', '' ],
      [ 'foo' ],
      [ 'foo', 1 ],
      {},
      { '0': null },
      { '0': false },
      { '0': true },
      { '0': 0 },
      { '0': 1 },
      { '0': 'bar' },
      { '0': 'foo' },
      { '0': 'foo', '1': false },
      { '0': 'foo', '1': true },
      { '0': 'foo', '1': 0 },
      { '0': 'foo', '1': '0' },
      { '0': 'foo', '1': 'bar' },
      { '0': 'quux' },
      { '1': 'foo' }
    ];

    keys.forEach(function (key) {
      var indexableString = toIndexableString(key);
      JSON.stringify(parseIndexableString(indexableString)).should.equal(
        JSON.stringify(key), 'check parseIndexableString for key: ' + key +
        '(indexable string is: ' + indexableString + ')');
    });
  });
  it('throws error in parseIndexableString on invalid input', function () {

    try {
      parseIndexableString('');
      should.fail("didn't expect to parse correctly");
    } catch (err) {
      should.exist(err);
    }
  });
});