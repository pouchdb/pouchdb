#!/usr/bin/env node
'use strict';

var repl = require("repl");
var utils = require('../lib/utils');
var prompt = '> ';
var _toPromise = utils.toPromise; // Backup old toPromise method

function truncate(string, length) {
  if (!string) {
    return string;
  }
  if (!length) {
    length = 400;
  }

  if (string.length > length) {
    return string.substring(0, length) + '...';
  } else {
    return string;
  }
}


// A patched toPromise function, to log the results of promise if required.
utils.toPromise = function (func, passPromise) {
  var fn = _toPromise(func, passPromise);

  var patchedFn =  function () {
    var args = Array.prototype.slice.call(arguments);
    var promise = fn.apply(this, args);

    function logResult(result, method) {
      method = method || 'log';

      patchedFn._dbInfo.then(function (info) {
        console[method](
          "\n==>", patchedFn._dbType, info.db_name, patchedFn._methodName,
          "\nargs: " + truncate(JSON.stringify(args)),
          "\nresult:", truncate(JSON.stringify(result, null, 2)),
          "\n==="
        );
        // Might not be the best of ideas.
        process.stdout.write(prompt);
      });
    }

    if (patchedFn._doPromiseLog && PatchedPouch.doPromiseLog) {
      return promise.then(function (result) {
        logResult(result);
      }, function (err) {
        logResult(err, 'error');
      });
    } else {
      return promise;
    }
  };

  // Few attributres for communcation with PatchedPouch constructor.
  patchedFn._isPromisingFunction = true;
  patchedFn._doPromiseLog = false;
  return patchedFn;
};

// Load pouchdb with the patched toPromise
var PouchDB = require('../');

// A Patched version of PouchDB - to complement what toPromise logging needs.
function PatchedPouch(name, opts, callback) {
  var db = new PouchDB(name, opts, callback);
  var excluded = ['info'];
  var dbInfo = db.info();
  var dbType = db.type();
  var doPromiseLog = false;

  for (var key in db) {
    if (key !== 'info' && typeof db[key] === 'function' &&
        db[key]._isPromisingFunction) {

      doPromiseLog = excluded.indexOf(key) < 0;
      // Update attributes to communicate back to toPromise's logging.
      utils.extend(db[key], {
        _doPromiseLog: doPromiseLog,
        _methodName: key,
        _dbInfo: dbInfo,
        _dbType: dbType
      });

    }
  }

  return db;
}
PatchedPouch.doPromiseLog = true;

utils.extend(repl.start({
  prompt: prompt
}).context, {
  PouchDB: PatchedPouch,
  P: PatchedPouch
});
