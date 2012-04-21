(function() {

  function replicate(src, target, callback) {
    fetchCheckpoint(src, target, function(checkpoint) {
      var results = [];
      var completed = false;
      var pending = 0;
      var last_seq = 0;
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

      src.changes({
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
                src.get(id, {revs: true, rev: rev}, function(err, doc) {
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
          last_seq = res.last_seq;
          completed = true;
          isCompleted();
        }
      });
    });
  }

  function toPouch(db, callback) {
    if (db instanceof Pouch) {
      return callback(null, db);
    }
    new Pouch(db, callback);
  }

  Pouch.replicate = function(src, target, callback) {
    toPouch(src, function(_, src) {
      toPouch(target, function(_, target) {
        replicate(src, target, callback);
      });
    });
  };

}).call(this);