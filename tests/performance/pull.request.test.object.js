'use strict';

module.exports = function (PouchDB, Promise) {
  var commonUtils = require('../common-utils.js'),
    log = require('debug')('pouchdb:tests:performance');

  var PullRequestTestObject = function (config) {
    if (config.generations <= 0) {
      throw new Error("generations must be > 0");
    }

    this.generations = config.generations;
    this.numberDocs = config.numberDocs;
    this.batchSize = config.batchSize;
    this.maxSockets = config.maxSockets;
    this.iterations = config.iterations;
    this.localPouches = [];

    return {
      name: config.name,
      assertions: 1,
      iterations: this.iterations,
      setup: this.setup(),
      test: this.test(),
      tearDown: this.tearDown()
    };
  };

  PullRequestTestObject.prototype.setup = function () {
    var self = this;
    return function (localDB, callback) {
      var remoteDBOpts = {ajax: {pool: {maxSockets: self.maxSockets}}},
        remoteCouchUrl =
          commonUtils.couchHost() + "/" +
          commonUtils.safeRandomDBName();

      self.remoteDB = new PouchDB(remoteCouchUrl, remoteDBOpts);

      var docs = [],
        i,
        localOpts = {ajax: {timeout: 60 * 1000}};

      for (i = 0; i < self.iterations; ++i) {
        self.localPouches[i] = new PouchDB(commonUtils.safeRandomDBName());
      }

      for (i = 0; i < self.numberDocs; i++) {
        docs.push(
          {
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

      return addGeneration(self.generations, docs).then(callback);
    };
  };

  PullRequestTestObject.prototype.test = function () {
    var self = this;
    return function (ignoreDB, itr, ignoreContext, done) {
      var localDB = self.localPouches[itr];

      PouchDB.replicate(self.remoteDB, localDB,
        {live: false, batch_size: self.batchSize})
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
      return self.remoteDB.destroy()
      .then(function () {
        return Promise.all(
          self.localPouches.map(function (localPouch) {
            return localPouch.destroy();
          }));
      });
    };
  };

  return PullRequestTestObject;
};
