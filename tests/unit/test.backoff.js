var should = require('chai').should();

var Pouch = require('../../packages/pouchdb-for-coverage');
var defaultBackOff = Pouch.utils.defaultBackOff;

describe('test.backoff.js', function () {

  it('defaultBackoff should start off at most 2 seconds and never exceed 10 minutes', function () {
    should.exist(defaultBackOff);
    var limit = 600000;
    var delay = 0;
    var values = [];
    for(var i=0; i<100; i++) {
      delay = defaultBackOff(delay);
      values.push(delay);
    }
    var max = Math.max.apply(null, values);
    values[0].should.be.at.most(2000);
    max.should.be.at.most(limit);
  });

});