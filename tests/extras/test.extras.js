'use strict';

var should = require('chai').should();

describe('test.extras.js', function () {

  it('extras/ajax should exist', function () {
    var ajax = require('../../packages/pouchdb/extras/ajax');
    should.exist(ajax);
    ajax.should.be.a('function');
    ajax.name.should.equal('ajax');
  });

  it('extras/checkpointer should exist', function () {
    var checkpointer = require('../../packages/pouchdb/extras/checkpointer');
    should.exist(checkpointer);
    checkpointer.should.be.a('function');
    checkpointer.name.should.equal('Checkpointer');
  });

  it('extras/promise should exist', function () {
    var promise = require('../../packages/pouchdb/extras/promise');
    should.exist(promise);
    promise.should.be.a('function');
    promise.name.should.equal('Promise');
  });

  it('extras/generateReplicationId should exist', function () {
    var genReplicationId = require(
      '../../packages/pouchdb/extras/generateReplicationId');
    should.exist(genReplicationId);
    genReplicationId.should.be.a('function');
    genReplicationId.name.should.equal('generateReplicationId');
  });

  it('plugin extras should exist', function () {
    require('../../packages/pouchdb/extras/memory').should.be.a('object');
    require('../../packages/pouchdb/extras/localstorage').should.be.a('object');
    require('../../packages/pouchdb/extras/fruitdown').should.be.a('object');
  });

});