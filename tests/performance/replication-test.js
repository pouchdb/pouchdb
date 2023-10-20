'use strict';

module.exports = function (PouchDB, Promise) {

  var NUM_DOCS = 1000;
  var MAX_SOCKETS = 15;
  var BATCH_SIZE = 100;

  var commonUtils = require('../common-utils.js');
  var log = require('debug')('pouchdb:tests:performance');

  var PullRequestTestObject = function () {};

  PullRequestTestObject.prototype.setup = function ({ itr, gens, openRevs=1, reverse=false }) {
    var self = this;
    return function (_, callback) {
      var i;
      var docs = [];
      var bulkDocsOpts = {ajax: {timeout: 60 * 1000}, new_edits: false};
      var remoteDbOpts = {ajax: {pool: {maxSockets: MAX_SOCKETS}}};

      const localPouches = [];
      const remoteDbs = [];
      self.sourceDbs = reverse ? localPouches : remoteDbs;
      self.targetDbs = reverse ? remoteDbs : localPouches;

      for (i = 0; i < itr; ++i) {
        localPouches[i] = new PouchDB(commonUtils.safeRandomDBName());

        const remoteCouchUrl = commonUtils.couchHost() + "/" +
          commonUtils.safeRandomDBName();
        remoteDbs[i] = new PouchDB(remoteCouchUrl, remoteDbOpts);
      }

      console.log('Generating docs...');
      for (i = 0; i < NUM_DOCS; i++) {
        for (let j = 0; j < openRevs; j++) {
          docs.push({
            _id: commonUtils.createDocId(i),
            foo: Math.random(),
            bar: Math.random(),
            _rev: '1-' + commonUtils.rev(),
          });
        }
      }

      Promise.all(self.sourceDbs.map(sourceDb => new Promise((resolve, reject) => {
        var addGeneration = function (generationCount, docs) {
          return sourceDb.bulkDocs({docs: docs}, bulkDocsOpts)
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

        return addGeneration(gens, docs).then(resolve).catch(reject);
      }))).then(() => callback()).catch(callback);
    };
  };

  PullRequestTestObject.prototype.test = function () {
    var self = this;
    return function (ignoreDB, itr, ignoreContext, done) {
      const sourceDb = self.sourceDbs[itr];
      const targetDb = self.targetDbs[itr];
      PouchDB.replicate(sourceDb, targetDb,
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
    return function () {
      return Promise.all([ ...self.sourceDbs, ...self.targetDbs ]
        .map(db => db.destroy));
    };
  };

  return PullRequestTestObject;
};
