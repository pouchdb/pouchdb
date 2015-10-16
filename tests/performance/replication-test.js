'use strict';

module.exports = function (PouchDB, Promise) {

  var NUM_DOCS = 1000;
  var MAX_SOCKETS = 15;
  var BATCH_SIZE = 100;

  var commonUtils = require('../common-utils.js');
  var log = require('debug')('pouchdb:tests:performance');

  var PullRequestTestObject = function () {
    this.localPouches = [];
  };

  PullRequestTestObject.prototype.setup = function (itr, gens) {
    var self = this;
    return function (localDB, callback) {
      var remoteDBOpts = {ajax: {pool: {maxSockets: MAX_SOCKETS}}};
      var remoteCouchUrl = commonUtils.couchHost() + "/" +
        commonUtils.safeRandomDBName();

      self.remoteDB = new PouchDB(remoteCouchUrl, remoteDBOpts);

      var i;
      var docs = [];
      var localOpts = {ajax: {timeout: 60 * 1000}};

      for (i = 0; i < itr; ++i) {
        self.localPouches[i] = new PouchDB(commonUtils.safeRandomDBName());
      }

      for (i = 0; i < NUM_DOCS; i++) {
        docs.push({
          _id: commonUtils.createDocId(i),
          foo: Math.random(),
          bar: Math.random()
        });
      }

      var addGeneration = function (generationCount, docs) {
        return self.remoteDB.bulkDocs({docs: docs}, localOpts)
          .then(function (bulkDocsResponse) {
            --generationCount;
            if (generationCount <= 0) {
              return {};
            }
            var updatedDocs = bulkDocsResponse.map(function (doc) {
              return {
                _id: doc.id,
                _rev: doc.rev,
                foo: Math.random(),
                bar: Math.random()
              };
            });
            return addGeneration(generationCount, updatedDocs);
          });
      };

      return addGeneration(gens, docs).then(callback);
    };
  };

  PullRequestTestObject.prototype.test = function () {
    var self = this;
    return function (ignoreDB, itr, ignoreContext, done) {
      var localDB = self.localPouches[itr];
      PouchDB.replicate(self.remoteDB, localDB,
        {live: false, batch_size: BATCH_SIZE})
      .on('change', function (info) {
        log("replication - info - " + JSON.stringify(info));
      })
      .on('complete', function (info) {
        log("replication - complete - " + JSON.stringify(info));
        done();
      })
      .on('error', function (err) {
        log("replication - error - " + JSON.stringify(err));
        throw err;
      });
    };
  };

  PullRequestTestObject.prototype.tearDown = function () {
    var self = this;
    return function (ignoreDB, ignoreContext) {
      return self.remoteDB.destroy().then(function () {
        return Promise.all(
          self.localPouches.map(function (localPouch) {
            return localPouch.destroy();
          }));
      });
    };
  };

  return PullRequestTestObject;
};
