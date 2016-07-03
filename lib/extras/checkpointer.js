'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var lie = _interopDefault(require('lie'));
var getArguments = _interopDefault(require('argsarray'));
var debug = _interopDefault(require('debug'));
var events = require('events');
var inherits = _interopDefault(require('inherits'));
var pouchdbCollate = require('pouchdb-collate');

/* istanbul ignore next */
var PouchPromise = typeof Promise === 'function' ? Promise : lie;

// most of this is borrowed from lodash.isPlainObject:
// https://github.com/fis-components/lodash.isplainobject/
// blob/29c358140a74f252aeb08c9eb28bef86f2217d4a/index.js

var funcToString = Function.prototype.toString;
var objectCtorString = funcToString.call(Object);

var log = debug('pouchdb:api');

// like underscore/lodash _.pick()
function pick(obj, arr) {
  var res = {};
  for (var i = 0, len = arr.length; i < len; i++) {
    var prop = arr[i];
    if (prop in obj) {
      res[prop] = obj[prop];
    }
  }
  return res;
}

// in Node of course this is false
function isChromeApp() {
  return false;
}

// in Node of course this is false
function hasLocalStorage() {
  return false;
}

inherits(Changes, events.EventEmitter);

/* istanbul ignore next */
function attachBrowserEvents(self) {
  if (isChromeApp()) {
    chrome.storage.onChanged.addListener(function (e) {
      // make sure it's event addressed to us
      if (e.db_name != null) {
        //object only has oldValue, newValue members
        self.emit(e.dbName.newValue);
      }
    });
  } else if (hasLocalStorage()) {
    if (typeof addEventListener !== 'undefined') {
      addEventListener("storage", function (e) {
        self.emit(e.key);
      });
    } else { // old IE
      window.attachEvent("storage", function (e) {
        self.emit(e.key);
      });
    }
  }
}

function Changes() {
  events.EventEmitter.call(this);
  this._listeners = {};

  attachBrowserEvents(this);
}
Changes.prototype.addListener = function (dbName, id, db, opts) {
  /* istanbul ignore if */
  if (this._listeners[id]) {
    return;
  }
  var self = this;
  var inprogress = false;
  function eventFunction() {
    /* istanbul ignore if */
    if (!self._listeners[id]) {
      return;
    }
    if (inprogress) {
      inprogress = 'waiting';
      return;
    }
    inprogress = true;
    var changesOpts = pick(opts, [
      'style', 'include_docs', 'attachments', 'conflicts', 'filter',
      'doc_ids', 'view', 'since', 'query_params', 'binary'
    ]);

    /* istanbul ignore next */
    function onError() {
      inprogress = false;
    }

    db.changes(changesOpts).on('change', function (c) {
      if (c.seq > opts.since && !opts.cancelled) {
        opts.since = c.seq;
        opts.onChange(c);
      }
    }).on('complete', function () {
      if (inprogress === 'waiting') {
        setTimeout(function (){
          eventFunction();
        },0);
      }
      inprogress = false;
    }).on('error', onError);
  }
  this._listeners[id] = eventFunction;
  this.on(dbName, eventFunction);
};

Changes.prototype.removeListener = function (dbName, id) {
  /* istanbul ignore if */
  if (!(id in this._listeners)) {
    return;
  }
  events.EventEmitter.prototype.removeListener.call(this, dbName,
    this._listeners[id]);
};


/* istanbul ignore next */
Changes.prototype.notifyLocalWindows = function (dbName) {
  //do a useless change on a storage thing
  //in order to get other windows's listeners to activate
  if (isChromeApp()) {
    chrome.storage.local.set({dbName: dbName});
  } else if (hasLocalStorage()) {
    localStorage[dbName] = (localStorage[dbName] === "a") ? "b" : "a";
  }
};

Changes.prototype.notify = function (dbName) {
  this.emit(dbName);
  this.notifyLocalWindows(dbName);
};

// We assume Node users don't need to see this warning
var res = function () {};

inherits(PouchError, Error);

function PouchError(opts) {
  Error.call(this, opts.reason);
  this.status = opts.status;
  this.name = opts.error;
  this.message = opts.reason;
  this.error = true;
}

PouchError.prototype.toString = function () {
  return JSON.stringify({
    status: this.status,
    name: this.name,
    message: this.message,
    reason: this.reason
  });
};

var UNAUTHORIZED = new PouchError({
  status: 401,
  error: 'unauthorized',
  reason: "Name or password is incorrect."
});

var MISSING_BULK_DOCS = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: "Missing JSON list of 'docs'"
});

var MISSING_DOC = new PouchError({
  status: 404,
  error: 'not_found',
  reason: 'missing'
});

var REV_CONFLICT = new PouchError({
  status: 409,
  error: 'conflict',
  reason: 'Document update conflict'
});

var INVALID_ID = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: '_id field must contain a string'
});

var MISSING_ID = new PouchError({
  status: 412,
  error: 'missing_id',
  reason: '_id is required for puts'
});

var RESERVED_ID = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Only reserved document ids may start with underscore.'
});

var NOT_OPEN = new PouchError({
  status: 412,
  error: 'precondition_failed',
  reason: 'Database not open'
});

var UNKNOWN_ERROR = new PouchError({
  status: 500,
  error: 'unknown_error',
  reason: 'Database encountered an unknown error'
});

var BAD_ARG = new PouchError({
  status: 500,
  error: 'badarg',
  reason: 'Some query argument is invalid'
});

var INVALID_REQUEST = new PouchError({
  status: 400,
  error: 'invalid_request',
  reason: 'Request was invalid'
});

var QUERY_PARSE_ERROR = new PouchError({
  status: 400,
  error: 'query_parse_error',
  reason: 'Some query parameter is invalid'
});

var DOC_VALIDATION = new PouchError({
  status: 500,
  error: 'doc_validation',
  reason: 'Bad special document member'
});

var BAD_REQUEST = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Something wrong with the request'
});

var NOT_AN_OBJECT = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Document must be a JSON object'
});

var DB_MISSING = new PouchError({
  status: 404,
  error: 'not_found',
  reason: 'Database not found'
});

var IDB_ERROR = new PouchError({
  status: 500,
  error: 'indexed_db_went_bad',
  reason: 'unknown'
});

var WSQ_ERROR = new PouchError({
  status: 500,
  error: 'web_sql_went_bad',
  reason: 'unknown'
});

var LDB_ERROR = new PouchError({
  status: 500,
  error: 'levelDB_went_went_bad',
  reason: 'unknown'
});

var FORBIDDEN = new PouchError({
  status: 403,
  error: 'forbidden',
  reason: 'Forbidden by design doc validate_doc_update function'
});

var INVALID_REV = new PouchError({
  status: 400,
  error: 'bad_request',
  reason: 'Invalid rev format'
});

var FILE_EXISTS = new PouchError({
  status: 412,
  error: 'file_exists',
  reason: 'The database could not be created, the file already exists.'
});

var MISSING_STUB = new PouchError({
  status: 412,
  error: 'missing_stub'
});

var INVALID_URL = new PouchError({
  status: 413,
  error: 'invalid_url',
  reason: 'Provided URL is invalid'
});

// BEGIN Math.uuid.js

/*!
Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/

/*
 * Generate a random uuid.
 *
 * USAGE: Math.uuid(length, radix)
 *   length - the desired number of characters
 *   radix  - the number of allowable values for each character.
 *
 * EXAMPLES:
 *   // No arguments  - returns RFC4122, version 4 ID
 *   >>> Math.uuid()
 *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
 *
 *   // One argument - returns ID of the specified length
 *   >>> Math.uuid(15)     // 15 character ID (default base=62)
 *   "VcydxgltxrVZSTV"
 *
 *   // Two arguments - returns ID of the specified length, and radix. 
 *   // (Radix must be <= 62)
 *   >>> Math.uuid(8, 2)  // 8 character ID (base=2)
 *   "01001010"
 *   >>> Math.uuid(8, 10) // 8 character ID (base=10)
 *   "47473046"
 *   >>> Math.uuid(8, 16) // 8 character ID (base=16)
 *   "098F4D35"
 */
var chars = (
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz'
).split('');

var CHECKPOINT_VERSION = 1;
var REPLICATOR = "pouchdb";
// This is an arbitrary number to limit the
// amount of replication history we save in the checkpoint.
// If we save too much, the checkpoing docs will become very big,
// if we save fewer, we'll run a greater risk of having to
// read all the changes from 0 when checkpoint PUTs fail
// CouchDB 2.0 has a more involved history pruning,
// but let's go for the simple version for now.
var CHECKPOINT_HISTORY_SIZE = 5;
var LOWEST_SEQ = 0;

function updateCheckpoint(db, id, checkpoint, session, returnValue) {
  return db.get(id).catch(function (err) {
    if (err.status === 404) {
      if (db.type() === 'http') {
        res(
          404, 'PouchDB is just checking if a remote checkpoint exists.'
        );
      }
      return {
        session_id: session,
        _id: id,
        history: [],
        replicator: REPLICATOR,
        version: CHECKPOINT_VERSION
      };
    }
    throw err;
  }).then(function (doc) {
    if (returnValue.cancelled) {
      return;
    }
    // Filter out current entry for this replication
    doc.history = (doc.history || []).filter(function (item) {
      return item.session_id !== session;
    });

    // Add the latest checkpoint to history
    doc.history.unshift({
      last_seq: checkpoint,
      session_id: session
    });

    // Just take the last pieces in history, to
    // avoid really big checkpoint docs.
    // see comment on history size above
    doc.history = doc.history.slice(0, CHECKPOINT_HISTORY_SIZE);

    doc.version = CHECKPOINT_VERSION;
    doc.replicator = REPLICATOR;

    doc.session_id = session;
    doc.last_seq = checkpoint;

    return db.put(doc).catch(function (err) {
      if (err.status === 409) {
        // retry; someone is trying to write a checkpoint simultaneously
        return updateCheckpoint(db, id, checkpoint, session, returnValue);
      }
      throw err;
    });
  });
}

function Checkpointer(src, target, id, returnValue) {
  this.src = src;
  this.target = target;
  this.id = id;
  this.returnValue = returnValue;
}

Checkpointer.prototype.writeCheckpoint = function (checkpoint, session) {
  var self = this;
  return this.updateTarget(checkpoint, session).then(function () {
    return self.updateSource(checkpoint, session);
  });
};

Checkpointer.prototype.updateTarget = function (checkpoint, session) {
  return updateCheckpoint(this.target, this.id, checkpoint,
    session, this.returnValue);
};

Checkpointer.prototype.updateSource = function (checkpoint, session) {
  var self = this;
  if (this.readOnlySource) {
    return PouchPromise.resolve(true);
  }
  return updateCheckpoint(this.src, this.id, checkpoint,
    session, this.returnValue)
    .catch(function (err) {
      if (isForbiddenError(err)) {
        self.readOnlySource = true;
        return true;
      }
      throw err;
    });
};

var comparisons = {
  "undefined": function (targetDoc, sourceDoc) {
    // This is the previous comparison function
    if (pouchdbCollate.collate(targetDoc.last_seq, sourceDoc.last_seq) === 0) {
      return sourceDoc.last_seq;
    }
    /* istanbul ignore next */
    return 0;
  },
  "1": function (targetDoc, sourceDoc) {
    // This is the comparison function ported from CouchDB
    return compareReplicationLogs(sourceDoc, targetDoc).last_seq;
  }
};

Checkpointer.prototype.getCheckpoint = function () {
  var self = this;
  return self.target.get(self.id).then(function (targetDoc) {
    if (self.readOnlySource) {
      return PouchPromise.resolve(targetDoc.last_seq);
    }

    return self.src.get(self.id).then(function (sourceDoc) {
      // Since we can't migrate an old version doc to a new one
      // (no session id), we just go with the lowest seq in this case
      /* istanbul ignore if */
      if (targetDoc.version !== sourceDoc.version) {
        return LOWEST_SEQ;
      }

      var version;
      if (targetDoc.version) {
        version = targetDoc.version.toString();
      } else {
        version = "undefined";
      }

      if (version in comparisons) {
        return comparisons[version](targetDoc, sourceDoc);
      }
      /* istanbul ignore next */
      return LOWEST_SEQ;
    }, function (err) {
      if (err.status === 404 && targetDoc.last_seq) {
        return self.src.put({
          _id: self.id,
          last_seq: LOWEST_SEQ
        }).then(function () {
          return LOWEST_SEQ;
        }, function (err) {
          if (isForbiddenError(err)) {
            self.readOnlySource = true;
            return targetDoc.last_seq;
          }
          /* istanbul ignore next */
          return LOWEST_SEQ;
        });
      }
      throw err;
    });
  }).catch(function (err) {
    if (err.status !== 404) {
      throw err;
    }
    return LOWEST_SEQ;
  });
};
// This checkpoint comparison is ported from CouchDBs source
// they come from here:
// https://github.com/apache/couchdb-couch-replicator/blob/master/src/couch_replicator.erl#L863-L906

function compareReplicationLogs(srcDoc, tgtDoc) {
  if (srcDoc.session_id === tgtDoc.session_id) {
    return {
      last_seq: srcDoc.last_seq,
      history: srcDoc.history
    };
  }

  return compareReplicationHistory(srcDoc.history, tgtDoc.history);
}

function compareReplicationHistory(sourceHistory, targetHistory) {
  // the erlang loop via function arguments is not so easy to repeat in JS
  // therefore, doing this as recursion
  var S = sourceHistory[0];
  var sourceRest = sourceHistory.slice(1);
  var T = targetHistory[0];
  var targetRest = targetHistory.slice(1);

  if (!S || targetHistory.length === 0) {
    return {
      last_seq: LOWEST_SEQ,
      history: []
    };
  }

  var sourceId = S.session_id;
  /* istanbul ignore if */
  if (hasSessionId(sourceId, targetHistory)) {
    return {
      last_seq: S.last_seq,
      history: sourceHistory
    };
  }

  var targetId = T.session_id;
  if (hasSessionId(targetId, sourceRest)) {
    return {
      last_seq: T.last_seq,
      history: targetRest
    };
  }

  return compareReplicationHistory(sourceRest, targetRest);
}

function hasSessionId(sessionId, history) {
  var props = history[0];
  var rest = history.slice(1);

  if (!sessionId || history.length === 0) {
    return false;
  }

  if (sessionId === props.session_id) {
    return true;
  }

  return hasSessionId(sessionId, rest);
}

function isForbiddenError(err) {
  return typeof err.status === 'number' && Math.floor(err.status / 100) === 4;
}

module.exports = Checkpointer;