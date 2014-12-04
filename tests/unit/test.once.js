
'use strict';

var should = require('chai').should();
var utils = require('../../lib/utils.js');

describe('test.once.js', function () {

  it('Only call once ... once', function () {
    var myFun = utils.once(function () { });
    myFun();
    should.throw(myFun);
  });

  it('Once wrapped in a promise', function (done) {
    var callback = function () {};
    var myFun = utils.toPromise(function (callback) {
      setTimeout(function () {
        callback();
        should.throw(callback);
        done();
      });
    });
    myFun(callback);
  });
});
