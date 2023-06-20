import CoreLevelPouch from 'pouchdb-adapter-leveldb-core';
import { fs } from 'pouchdb-platform';
import path from 'node:path';
import { isLocalId, winningRev } from 'pouchdb-merge';
import level from 'level';
import { o as obj } from './through2-358f03fa.js';
import LevelWriteStream from 'level-write-stream';
import 'stream';
import './_commonjsHelpers-7d1333e8.js';
import 'events';
import 'buffer';
import 'util';

// require leveldown. provide verbose output on error as it is the default
// nodejs adapter, which we do not provide for the user
/* istanbul ignore next */
var requireLeveldown = function () {
  try {
    return require('leveldown');
  } catch (err) {
    /* eslint no-ex-assign: 0*/
    err = err || 'leveldown import error';
    if (err.code === 'MODULE_NOT_FOUND') {
      // handle leveldown not installed case
      return new Error([
        'the \'leveldown\' package is not available. install it, or,',
        'specify another storage backend using the \'db\' option'
      ].join(' '));
    } else if (err.message && err.message.match('Module version mismatch')) {
      // handle common user enviornment error
      return new Error([
        err.message,
        'This generally implies that leveldown was built with a different',
        'version of node than that which is running now.  You may try',
        'fully removing and reinstalling PouchDB or leveldown to resolve.'
      ].join(' '));
    }
    // handle general internal nodejs require error
    return new Error(err.toString() + ': unable to import leveldown');
  }
};

var stores = [
  'document-store',
  'by-sequence',
  'attach-store',
  'attach-binary-store'
];
function formatSeq(n) {
  return ('0000000000000000' + n).slice(-16);
}
var UPDATE_SEQ_KEY = '_local_last_update_seq';
var DOC_COUNT_KEY = '_local_doc_count';
var UUID_KEY = '_local_uuid';

var doMigrationOne = function (name, db, callback) {
  // local require to prevent crashing if leveldown isn't installed.
  var leveldown = require("leveldown");

  var base = path.resolve(name);
  function move(store, index, cb) {
    var storePath = path.join(base, store);
    var opts;
    if (index === 3) {
      opts = {
        valueEncoding: 'binary'
      };
    } else {
      opts = {
        valueEncoding: 'json'
      };
    }
    var sub = db.sublevel(store, opts);
    var orig = level(storePath, opts);
    var from = orig.createReadStream();
    var writeStream = new LevelWriteStream(sub);
    var to = writeStream();
    from.on('end', function () {
      orig.close(function (err) {
        cb(err, storePath);
      });
    });
    from.pipe(to);
  }
  fs.unlink(base + '.uuid', function (err) {
    if (err) {
      return callback();
    }
    var todo = 4;
    var done = [];
    stores.forEach(function (store, i) {
      move(store, i, function (err, storePath) {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }
        done.push(storePath);
        if (!(--todo)) {
          done.forEach(function (item) {
            leveldown.destroy(item, function () {
              if (++todo === done.length) {
                fs.rmdir(base, callback);
              }
            });
          });
        }
      });
    });
  });
};
var doMigrationTwo = function (db, stores, callback) {
  var batches = [];
  stores.bySeqStore.get(UUID_KEY, function (err, value) {
    if (err) {
      // no uuid key, so don't need to migrate;
      return callback();
    }
    batches.push({
      key: UUID_KEY,
      value: value,
      prefix: stores.metaStore,
      type: 'put',
      valueEncoding: 'json'
    });
    batches.push({
      key: UUID_KEY,
      prefix: stores.bySeqStore,
      type: 'del'
    });
    stores.bySeqStore.get(DOC_COUNT_KEY, function (err, value) {
      if (value) {
        // if no doc count key,
        // just skip
        // we can live with this
        batches.push({
          key: DOC_COUNT_KEY,
          value: value,
          prefix: stores.metaStore,
          type: 'put',
          valueEncoding: 'json'
        });
        batches.push({
          key: DOC_COUNT_KEY,
          prefix: stores.bySeqStore,
          type: 'del'
        });
      }
      stores.bySeqStore.get(UPDATE_SEQ_KEY, function (err, value) {
        if (value) {
          // if no UPDATE_SEQ_KEY
          // just skip
          // we've gone to far to stop.
          batches.push({
            key: UPDATE_SEQ_KEY,
            value: value,
            prefix: stores.metaStore,
            type: 'put',
            valueEncoding: 'json'
          });
          batches.push({
            key: UPDATE_SEQ_KEY,
            prefix: stores.bySeqStore,
            type: 'del'
          });
        }
        var deletedSeqs = {};
        stores.docStore.createReadStream({
          startKey: '_',
          endKey: '_\xFF'
        }).pipe(obj(function (ch, _, next) {
          if (!isLocalId(ch.key)) {
            return next();
          }
          batches.push({
            key: ch.key,
            prefix: stores.docStore,
            type: 'del'
          });
          var winner = winningRev(ch.value);
          Object.keys(ch.value.rev_map).forEach(function (key) {
            if (key !== 'winner') {
              this.push(formatSeq(ch.value.rev_map[key]));
            }
          }, this);
          var winningSeq = ch.value.rev_map[winner];
          stores.bySeqStore.get(formatSeq(winningSeq), function (err, value) {
            if (!err) {
              batches.push({
                key: ch.key,
                value: value,
                prefix: stores.localStore,
                type: 'put',
                valueEncoding: 'json'
              });
            }
            next();
          });

        })).pipe(obj(function (seq, _, next) {
          /* istanbul ignore if */
          if (deletedSeqs[seq]) {
            return next();
          }
          deletedSeqs[seq] = true;
          stores.bySeqStore.get(seq, function (err, resp) {
            /* istanbul ignore if */
            if (err || !isLocalId(resp._id)) {
              return next();
            }
            batches.push({
              key: seq,
              prefix: stores.bySeqStore,
              type: 'del'
            });
            next();
          });
        }, function () {
          db.batch(batches, callback);
        }));
      });
    });
  });

};

var migrate = {
  doMigrationOne: doMigrationOne,
  doMigrationTwo: doMigrationTwo
};

function LevelDownPouch(opts, callback) {

  // Users can pass in their own leveldown alternative here, in which case
  // it overrides the default one. (This is in addition to the custom builds.)
  var leveldown = opts.db;

  /* istanbul ignore else */
  if (!leveldown) {
    leveldown = requireLeveldown();

    /* istanbul ignore if */
    if (leveldown instanceof Error) {
      return callback(leveldown);
    }
  }

  var _opts = Object.assign({
    db: leveldown,
    migrate: migrate
  }, opts);

  CoreLevelPouch.call(this, _opts, callback);
}

// overrides for normal LevelDB behavior on Node
LevelDownPouch.valid = function () {
  return true;
};
LevelDownPouch.use_prefix = false;

function index (PouchDB) {
  PouchDB.adapter('leveldb', LevelDownPouch, true);
}

export { index as default };
