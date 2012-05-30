(function() {

  function replicate(src, target, opts, callback, replicateRet) {

    fetchCheckpoint(src, target, function(checkpoint) {
      var results = [];
      var completed = false;
      var pending = 0;
      var last_seq = 0;
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
          writeCheckpoint(src, target, last_seq, function() {
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
        onChange: function(change) {
          results.push(change);
          result.docs_read++;
          pending++;
          var diff = {};
          diff[change.id] = change.changes.map(function(x) { return x.rev; });
          target.revsDiff(diff, function(err, diffs) {
            for (var id in diffs) {
              diffs[id].missing.map(function(rev) {
                src.get(id, {revs: true, rev: rev, attachments: true}, function(err, doc) {
                  target.bulkDocs({docs: [doc]}, {new_edits: false}, function() {
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
          if (res) {
            last_seq = res.last_seq;
          }
          completed = true;
          isCompleted();
        }
      };

      if (opts.filter) {
        repOpts.filter = opts.filter;
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
    var ret = function() {
      this.cancelled = false;
      this.cancel = function() {
        this.cancelled = true;
      }
    }
    var replicateRet = new ret();
    toPouch(src, function(_, src) {
      toPouch(target, function(_, target) {
        replicate(src, target, opts, callback, replicateRet);
      });
    });
    return replicateRet;
  };

}).call(this);