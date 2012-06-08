(function() {
  function getStep(rev){
    return parseInt(rev.split('-')[0])
  }
  function getHead(revs){
    return revs.reduce(function(a,b) { return  getStep(a) < getStep(b) ? b : a;   });
  }
  function getRevs(revs){
    return revs.sort( function(rev1,rev2){ return getStep(rev2) - getStep(rev1); }).map(function(rev){return rev.split('-')[1]});
  }
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

      function replicateDoc(id, missing, possible_ancestors, cb){
        var rev = getHead(missing),
          new_edits = true;
        src.get(id, {revs: true, rev: rev, attachments: true},function(err,doc){
          if (!!!doc){
            var head = getHead(possible_ancestors);
            doc = { _id : id , _rev: head, _deleted : true, _revisions: {"start":parseInt(head.split('-')[0]),"ids":getRevs(possible_ancestors)}};
            new_edits = false;
          }
          console.error(doc);
          console.log(new_edits ? {new_edits: false} : {});
          target.bulkDocs({docs: [doc]}, new_edits ? {new_edits: false} : {}, cb);
        });
      }

      var repOpts = {
        continuous: continuous,
        since: checkpoint,
        onChange: function(change) {
          last_seq = change.seq;
          results.push(change);
          result.docs_read++;
          pending++;
          var diff = {};
          diff[change.id] = change.changes.map(function(x) { return x.rev; });
          target.revsDiff(diff, function(err, diffs) {
            if (Object.keys(diffs).length === 0) {
              pending--;
              isCompleted();
              return;
            }
            for (var id in diffs) {
              var cb = function() {
                    result.docs_written++;
                    pending--;
                    isCompleted();
                  };
              replicateDoc(id, diffs[id].missing, diffs[id].possible_ancestors, cb);
            }
          });
        },
        complete: function(err, res) {
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
    // TODO: This needs some cleaning up, from the replicate call I want
    // to return a promise in which I can cancel continuous replications
    // this will just proxy requests to cancel the changes feed but only
    // after we start actually running the changes feed
    var ret = function() {
      this.cancelled = false;
      this.cancel = function() {
        this.cancelled = true;
      }
    }
    var replicateRet = new ret();
    toPouch(src, function(_, src) {
      toPouch(target, function(_, target) {
        if (typeof opts == typeof Function && typeof callback == typeof undefined){
          callback = opts;
        }
        replicate(src, target, opts, callback, replicateRet);
      });
    });
    return replicateRet;
  };

}).call(this);