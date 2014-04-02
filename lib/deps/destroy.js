'use strict';

var destroyQueue = [];
var destroyInProgress = false;

function destroyNext() {
  if (destroyInProgress || !destroyQueue.length) {
    return;
  }
  destroyInProgress = true;
  var task = destroyQueue.shift();
  function callback(err, resp) {
    task.callback(err, resp);
    destroyInProgress = false;
    destroyNext();
  }
  if (task.name) {
    createThenDestroy(task.name, task.adapter, task.opts, callback);
  } else {
    destroyDB(task.db, task.opts, callback);
  }
}

function createThenDestroy(name, adapter, opts, callback) {
  new PouchDB(name, {adapter : adapter}, function (err, db) {
    if (err) {
      return callback(err);
    }
    destroyDB(db, opts, callback);
  });
}

function destroyDB(db, opts, callback) {
  db.info(function (err, info) {
    if (err) {
      return callback(err);
    }

    function destroyDB() {
      db._destroy(opts, function (err, resp) {
        if (err) {
          callback(err);
        } else {
          PouchDB.emit('destroyed', info.db_name);
          PouchDB.emit(info.db_name, 'destroyed');
          callback(null, resp);
        }
      });
    }

    if (db.type() === 'http') {
      return destroyDB();
    }

    // destroy dependent dbs
    db.get('_local/dependentDbs', function (err, localDoc) {
      if (err) {
        if (err.name !== 'not_found') {
          return callback(err);
        } else { // no dependencies
          return destroyDB();
        }
      }
      var dependentDbs = localDoc.dependentDbs;
      var numDone = 0;
      var numStarted = 0;
      var error;
      Object.keys(dependentDbs).forEach(function (dependentDb) {
        numStarted++;
        new PouchDB(dependentDb, {adapter : db.adapter}, function (err, dependentDB) {
          dependentDB.destroy(opts, function (err) {
            if (err) {
              error = err;
            }
            if (++numDone === numStarted) {
              if (error) {
                return callback(error);
              } else {
                destroyDB();
              }
            }
          });
        });
      });
    });
  });
}

function destroyPouch(Pouch, name, adapter, opts, callback) {

  PouchDB = Pouch;

  if (typeof name !== 'string') {
    destroyQueue.push({
      db : name,
      opts : opts,
      callback : callback
    });
  } else {
    destroyQueue.push({
      name : name,
      adapter : adapter,
      opts : opts,
      callback : callback
    });
  }

  destroyNext();
}

module.exports = destroyPouch;

