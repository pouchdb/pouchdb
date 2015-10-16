'use strict';

var should = require('chai').should();

describe('test.extras.js', function () {

  it('extras/ajax should exist', function () {
    var ajax = require('../../extras/ajax');
    should.exist(ajax);
    ajax.should.be.a('function');
    ajax.name.should.equal('ajax');
  });

  it('extras/checkpointer should exist', function () {
    var checkpointer = require('../../extras/checkpointer');
    should.exist(checkpointer);
    checkpointer.should.be.a('function');
    checkpointer.name.should.equal('Checkpointer');
  });

  it('extras/promise should exist', function () {
    var promise = require('../../extras/promise');
    should.exist(promise);
    promise.should.be.a('function');
    promise.name.should.equal('Promise');
  });

  it('extras/generateReplicationId should exist', function () {
    var genReplicationId = require('../../extras/generateReplicationId');
    should.exist(genReplicationId);
    genReplicationId.should.be.a('function');
    genReplicationId.name.should.equal('generateReplicationId');
  });

});