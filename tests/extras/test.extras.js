'use strict';

var should = require('chai').should();

describe('test.extras.js', function () {

  it('extras/ajax should exist', function () {
    var ajax = require('../../packages/node_modules/pouchdb/extras/ajax');
    should.exist(ajax);
    ajax.should.be.a('function');
    ajax.name.should.equal('ajax');
  });

  it('extras/checkpointer should exist', function () {
    var checkpointer = require('../../packages/node_modules/pouchdb/extras/checkpointer');
    should.exist(checkpointer);
    checkpointer.should.be.a('function');
    checkpointer.name.should.equal('Checkpointer');
  });

  it('extras/promise should exist', function () {
    var promise = require('../../packages/node_modules/pouchdb/extras/promise');
    should.exist(promise);
    promise.should.be.a('function');
    promise.name.should.equal('Promise');
  });

  it('extras/generateReplicationId should exist', function () {
    var genReplicationId = require(
      '../../packages/node_modules/pouchdb/extras/generateReplicationId');
    should.exist(genReplicationId);
    genReplicationId.should.be.a('function');
    genReplicationId.name.should.equal('generateReplicationId');
  });

  it('plugin extras should exist', function () {
    require('../../packages/node_modules/pouchdb/extras/memory').should.be.a('object');
    require('../../packages/node_modules/pouchdb/extras/localstorage').should.be.a('object');
    require('../../packages/node_modules/pouchdb/extras/fruitdown').should.be.a('object');
  });

});