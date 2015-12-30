
'use strict';

var should = require('chai').should();
var once = require('../../lib_unit/deps/once').default;
var toPromise = require('../../lib_unit/deps/toPromise').default;

describe('test.once.js', function () {

  it('Only call once ... once', function () {
    var myFun = once(function () { });
    myFun();
    should.throw(myFun);
  });

  it('Once wrapped in a promise', function (done) {
    var callback = function () {};
    var myFun = toPromise(function (callback) {
      setTimeout(function () {
        callback();
        should.throw(callback);
        done();
      });
    });
    myFun(callback);
  });
});
