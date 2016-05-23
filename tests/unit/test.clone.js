
'use strict';

var should = require('chai').should();
var PouchDB = require('../../packages/pouchdb-for-coverage');
var clone = PouchDB.utils.clone;

describe('test.clone.js', function () {

  it('Clones regular objects', function () {
    var obj1 = {foo: 'bar'};
    var obj2 = clone(obj1);
    obj1.baz = 'quuz';
    should.not.exist(obj2.baz);
  });

  it('Doesn\'t clone fancy objects', function () {

    function Kitty() {
    }

    Kitty.prototype.meow = function () {
      return 'meow';
    };

    var obj1 = {kitty: new Kitty()};
    var obj2 = clone(obj1);
    obj1.kitty.meow().should.equal('meow');
    obj2.kitty.meow().should.equal('meow');
    obj1.kitty.foo = 'bar';
    obj2.kitty.foo.should.equal('bar');
  });
});
