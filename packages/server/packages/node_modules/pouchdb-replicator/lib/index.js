/*
	Copyright 2014-2015, Marten de Vries

	Licensed under the Apache License, Version 2.0 (the 'License');
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an 'AS IS' BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

'use strict';

var Promise = require('pouchdb-promise');
var nodify = require('promise-nodify');
var uuid = require('random-uuid-v4');
var Validation = require('pouchdb-validation');
var equals = require('equals');
var extend = require('extend');
var PouchPluginError = require('pouchdb-plugin-error');
var systemDB = require('pouchdb-system-db');
const url = require('url');

//to update: http://localhost:5984/_replicator/_design/_replicator & remove _rev.
var DESIGN_DOC = require('./designdoc.js');

var dbData = {
  dbs: [],
  data: []
};

exports.startReplicator = function (callback) {
  var db = this;
  var promise = exports.startReplicatorDaemon.call(db)
    .then(function () {
      exports.useAsReplicatorDB.call(db);
    });
  nodify(promise, callback);
  return promise;
};

exports.startReplicatorDaemon = function (callback) {
  //When the replicator is started:
  //- replication is started for every already existing document in the
  //  database
  //- subscribing 'live' to the changes feed of the database commences
  //  for future updates

  var db = this;

  if (dbData.dbs.indexOf(db) !== -1) {
    return Promise.reject(new PouchPluginError({
      status: 500,
      name: 'already_active',
      message: "Replicator already active on this database."
    }));
  }

  var i = dbData.dbs.push(db) - 1;
  dbData.data[i] = {
    // changes is set below
    activeReplicationsById: {},
    activeReplicationSignaturesByRepId: {},
    changedByReplicator: []
  };

  var promise = db.put(DESIGN_DOC)
    .catch(function () {/*that's fine, probably already there*/})
    .then(function () {
      return db.allDocs({
        include_docs: true
      });
    })
    .then(function (allDocs) {
      //start replication for current docs
      allDocs.rows.forEach(function (row) {
        onChanged(db, row.doc);
      });
    })
    .then(function () {
      //start listening for changes on the replicator db
      var changes = db.changes({
        since: 'now',
        live: true,
        returnDocs: false,
        include_docs: true
      });
      changes.on('change', function (change) {
        onChanged(db, change.doc);
      });
      dbData.data[i].changes = changes;
    });

  nodify(promise, callback);
  return promise;
};

const createSafeUrl = (source) => {
  if (typeof source === 'string') {
    return source;
  }

  if (source.name) {
    return source;
  }

  const formattedUrl = url.parse(source.url);
  if (source.headers.Authorization) {
    const base64Auth = Buffer.from(source.headers.Authorization.replace("Basic ",""), 'base64');
    formattedUrl.auth = base64Auth.toString('utf-8');
  }

  return url.format(formattedUrl);
};

exports.createSafeUrl = createSafeUrl;

function onChanged(db, doc) {
  //Stops/starts replication as required by the description in ``doc``.

  var data = dataFor(db);

  var isReplicatorChange = data.changedByReplicator.indexOf(doc._id) !== -1;
  if (isReplicatorChange) {
    data.changedByReplicator.splice(doc._id, 1);
  }
  if (isReplicatorChange || doc._id.indexOf('_design') === 0) {
    //prevent recursion & design docs respectively
    return;
  }
  var currentSignature;
  var docCopy = extend({}, doc);

  //stop an ongoing replication (if one)
  var oldReplication = data.activeReplicationsById[doc._id];
  if (oldReplication) {
    oldReplication.cancel();
  }
  if (doc._replication_id) {
    currentSignature = data.activeReplicationSignaturesByRepId[doc._replication_id];
  }
  //removes the data used to get cancel & currentSignature now it's no
  //longer necessary
  cleanupReplicationData(db, doc);

  if (!doc._deleted) {
    //update doc so it's ready to be replicated (if necessary).
    currentSignature = extend({}, doc);
    delete currentSignature._id;
    delete currentSignature._rev;

    //check if the signatures match ({repId: signature} format). If it
    //does, it's a duplicate replication which means that it just gets
    //the id assigned of the already active replication and nothing else
    //happens.
    var repId = getMatchingSignatureId(db, currentSignature);
    if (repId) {
      doc._replication_id = repId;
    } else {
      doc._replication_id = uuid();
      doc._replication_state = 'triggered';
    }
  }
  if (doc._replication_state === 'triggered') {
    //(re)start actual replication
    var PouchDB = db.constructor;
    doc.userCtx = doc.user_ctx;
    var opts = extend({retry: true}, doc);
    var replication = PouchDB.replicate(createSafeUrl(doc.source), createSafeUrl(doc.target), opts);
    data.activeReplicationsById[doc._id] = replication;
    data.activeReplicationSignaturesByRepId[doc._replication_id] = currentSignature;

    replication.then(onReplicationComplete.bind(null, db, doc._id));
    replication.catch(onReplicationError.bind(null, db, doc._id));
  }

  if (!equals(doc, docCopy)) {
    putAsReplicatorChange(db, doc);
  }
}

function dataFor(db) {
  var dbIdx = dbData.dbs.indexOf(db);
  if (dbIdx === -1) {
    throw new Error("db doesn't exist");
  }
  return dbData.data[dbIdx];
}

function cleanupReplicationData(db, doc) {
  //cleanup replication data which is now no longer necessary
  var data = dataFor(db);

  delete data.activeReplicationsById[doc._id];
  delete data.activeReplicationSignaturesByRepId[doc._replication_id];
}

function getMatchingSignatureId(db, searchedSignature) {
  var data = dataFor(db);

  for (var repId in data.activeReplicationSignaturesByRepId) {
    /* istanbul ignore else */
    if (data.activeReplicationSignaturesByRepId.hasOwnProperty(repId)) {
      var signature = data.activeReplicationSignaturesByRepId[repId];
      // it's hard to guarantee that a signature isn't being found first in a
      // test, with little benefit:
      /* istanbul ignore else*/
      if (equals(signature, searchedSignature)) {
        return repId;
      }
    }
  }
}

function onReplicationComplete(db, docId, info) {
  delete info.status;
  delete info.ok;
  updateExistingDoc(db, docId, function (doc) {
    doc._replication_state = 'completed';
    doc._replication_stats = info;
  });
}

function updateExistingDoc(db, docId, func) {
  db.get(docId).then(function (doc) {
    cleanupReplicationData(db, doc);

    func(doc);
    putAsReplicatorChange(db, doc).catch(function (err) {
      /* istanbul ignore else */
      if (err.status === 409) {
        updateExistingDoc(db, docId, func);
      } else {
        // should never happen, but there for debugging purposes.
        throw err;
      }
    });
  });
}

function putAsReplicatorChange(db, doc) {
  if (doc._replication_state) {
    doc._replication_state_time = new Date().toISOString();
  }

  var data = dataFor(db);
  data.changedByReplicator.push(doc._id);

  return db.put(doc, {
    userCtx: {
      roles: ['_replicator', '_admin']
    }
  }).catch(function (err) {
    var idx = data.changedByReplicator.indexOf(doc._id);
    data.changedByReplicator.splice(idx, 1);

    throw err;
  });
}

function onReplicationError(db, docId, info) {
  updateExistingDoc(db, docId, function (doc) {
    doc._replication_state = 'error';
    doc._replication_state_reason = info.message;
  });
}

exports.useAsReplicatorDB = function () {
  //applies strict validation rules (using the pouchdb-validation
  //plug-in behind the screens) to the database.

  Validation.installValidationMethods.call(this);
  systemDB.installSystemDBProtection(this);
};

exports.stopReplicator = function (callback) {
  var db = this;
  var promise = exports.stopReplicatorDaemon.call(db)
    .then(function () {
      exports.stopUsingAsReplicatorDB.call(db);
    });
  nodify(promise, callback);
  return promise;
};

exports.stopReplicatorDaemon = function (callback) {
  //Stops all replications & listening to future changes & relaxes the
  //validation rules for the database again.
  var db = this;
  var data;

  try {
    data = dataFor(db);
  } catch (err) {
    return Promise.reject(new PouchPluginError({
      status: 500,
      name: 'already_inactive',
      message: "Replicator already inactive on this database."
    }));
  }
  var index = dbData.dbs.indexOf(db);
  //clean up
  dbData.dbs.splice(index, 1);
  dbData.data.splice(index, 1);

  var promise = new Promise(function (resolve) {
    //cancel changes/replications
    var stillCancellingCount = 0;
    function doneCancelling(eventEmitter) {
      //listening is no longer necessary.
      eventEmitter.removeAllListeners();

      stillCancellingCount -= 1;
      if (stillCancellingCount === 0) {
        resolve();
      }
    }
    function cancel(cancelable) {
      cancelable.on('complete', doneCancelling.bind(null, cancelable));
      cancelable.on('error', doneCancelling.bind(null, cancelable));
      process.nextTick(cancelable.cancel.bind(cancelable));
      stillCancellingCount += 1;
    }
    cancel(data.changes);
    data.changes.removeAllListeners('change');

    for (var id in data.activeReplicationsById) {
      /* istanbul ignore next */
      if (data.activeReplicationsById.hasOwnProperty(id)) {
        cancel(data.activeReplicationsById[id]);
      }
    }
  });

  nodify(promise, callback);
  return promise;
};

exports.stopUsingAsReplicatorDB = function () {
  systemDB.uninstallSystemDBProtection(this);
  Validation.uninstallValidationMethods.call(this);
};
