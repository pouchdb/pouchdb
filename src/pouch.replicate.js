/*globals fetchCheckpoint: false, writeCheckpoint: false, call: false */

'use strict';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pouch;
}

function replicate(src, target, opts, callback, replicateRet) {

  fetchCheckpoint(src, target, opts, function(checkpoint) {
    var results = [];
    var completed = false;
    var pending = 0;
    var last_seq = checkpoint;
    var continuous = opts.continuous || false;
    var result = {
      ok: true,
      start_time: new Date(),
      docs_read: 0,
      docs_written: 0
    };

    function isCompleted() {
      if (completed && pending === 0) {
        result.end_time = new Date();
        writeCheckpoint(src, target, opts, last_seq, function() {
          call(callback, null, result);
        });
      }
    }

    if (replicateRet.cancelled) {
      return;
    }

    var repOpts = {
      continuous: continuous,
      since: checkpoint,
      style: 'all_docs',
      onChange: function(change) {
        last_seq = change.seq;
        results.push(change);
        result.docs_read++;
        pending++;
        var diff = {};
        diff[change.id] = change.changes.map(function(x) { return x.rev; });
        target.revsDiff(diff, function(err, diffs) {
          if (err) {
            if (continuous) {
              replicateRet.cancel();
            }
            call(callback, err, null);
            return;
          }
          if (Object.keys(diffs).length === 0) {
            pending--;
            isCompleted();
            return;
          }
          for (var id in diffs) {
            /*jshint loopfunc: true */
            diffs[id].missing.map(function(rev) {
              src.get(id, {revs: true, rev: rev, attachments: true}, function(err, doc) {
                target.bulkDocs({docs: [doc]}, {new_edits: false}, function() {
                  if (opts.onChange) {
                    opts.onChange.apply(this, [result]);
                  }
                  result.docs_written++;
                  pending--;
                  isCompleted();
                });
              });
            });
          }
        });
      },
      complete: function(err, res) {
        if (err) {
          call(callback, err, null);
        } else {
          completed = true;
          isCompleted(err);
        }
      }
    };

    if (opts.filter) {
      repOpts.filter = opts.filter;
    }

    if (opts.query_params) {
      repOpts.query_params = opts.query_params;
    }

    var changes = src.changes(repOpts);
    if (opts.continuous) {
      replicateRet.cancel = changes.cancel;
    }
  });
}

function toPouch(db, callback) {
  if (typeof db === 'string') {
    return new Pouch(db, callback);
  }
  callback(null, db);
}

Pouch.replicate = function(src, target, opts, callback) {
  // TODO: This needs some cleaning up, from the replicate call I want
  // to return a promise in which I can cancel continuous replications
  // this will just proxy requests to cancel the changes feed but only
  // after we start actually running the changes feed
  if (opts instanceof Function) {
    callback = opts;
    opts = {};
  }
  if (opts === undefined) {
    opts = {};
  }

  var Ret = function() {
    this.cancelled = false;
    this.cancel = function() {
      this.cancelled = true;
    };
  };
  var replicateRet = new Ret();
  toPouch(src, function(err, src) {
    if (err) {
      return call(callback, err);
    }
    toPouch(target, function(err, target) {
      if (err) {
        return call(callback, err);
      }
      replicate(src, target, opts, callback, replicateRet);
    });
  });
  return replicateRet;
};
