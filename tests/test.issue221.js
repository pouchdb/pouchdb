var adapters = [
    ['idb-1', 'http-1']
  ]
  , qunit = module;

if (typeof module !== undefined && module.exports) {
  this.Pouch = require('../src/pouch.js');
  this.LevelPouch = require('../src/adapters/pouch.leveldb.js');
  this.utils = require('./test.utils.js')
  this.ajax = Pouch.utils.ajax

  for (var k in this.utils) {
    global[k] = global[k] || this.utils[k];
  }
  adapters = [
    ['leveldb-1', 'http-1']
  ]
  qunit = QUnit.module;
}

adapters.map(function(adapters) {

  qunit('replication + compaction', {
    setup: function() {
      this.local = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
    }
  });

  var doc = { _id: '0', integer: 0 };

  asyncTest('Testing issue #221', function() {
    console.log('wtf1');
    var self = this;
    // Create databases.
    initDBPair(this.local, this.remote, function(local, remote) {
      console.log('db inited');
      // Write a doc in CouchDB.
      remote.put(doc, {}, function(err, results) {
        console.log('wrote doc');
        // Update the doc.
        doc._rev = results.rev;
        doc.integer = 1;
        remote.put(doc, {}, function(err, results) {
          console.log('wrote another doc');
          // Compact the db.
          ajax({
            url: self.remote + '/_compact',
            type: 'POST',
            contentType: 'application/json',
            success: function(data, status, jqXHR) {
              console.log('compacted');
              // Wait until compaction has affected the doc.
              var interval = null;
              var checkDoc = function() {
                console.log('in checkdoc');
                ajax({
                  url: self.remote + '/' + doc._id + '?revs_info=true',
                  dataType: 'json',
                  success: function(data, status, jqXHR) {
                    console.log('in checkdoc success');
                    var correctRev = data._revs_info[0];
                    if (data._revs_info[1].status == 'missing') {
                      // We already finished these tests, just managed to make 
                      // a whole other http request while we were just realising
                      if (!interval) { 
                        return;
                      }
                      clearInterval(interval);
                      interval = null;
                      // Replicate to PouchDB.
                      local.replicate.from(remote, function(err, results) {
                        console.log('replicated');
                        // Check the PouchDB doc.
                        local.get(doc._id, function(err, results) {
                          console.log('got');
                          ok(results._rev == correctRev.rev,
                             'correct rev stored after replication');
                          ok(results.integer == 1,
                             'correct content stored after replication');
                          start();
                        });
                      });
                    }
                  }
                });
              };
              interval = setInterval(checkDoc, 100);
            }
          });
        });
      });
    });
  });

  asyncTest('Testing issue #221 again', function() {
    console.log('wtf2');
    var self = this;
    // Create databases.
    initDBPair(this.local, this.remote, function(local, remote) {
      console.log('inited2');
      // Write a doc in CouchDB.
      remote.put(doc, {}, function(err, results) {
        console.log('put2');
        doc._rev = results.rev;
        // Second doc so we get 2 revisions from replicate.
        remote.put(doc, {}, function(err, results) {
          console.log('put3');
          doc._rev = results.rev;
          local.replicate.from(remote, function(err, results) {
            console.log('replicated');
            doc.integer = 1;
            // One more change
            remote.put(doc, {}, function(err, results) {
              console.log('put4');
              // Testing if second replications fails now
              local.replicate.from(remote, function(err, results) {
                console.log('replicated2');
                local.get(doc._id, function(err, results) {
                  console.log('bhat the boz');
                  ok(results.integer == 1, 'correct content stored after replication');
                  start();
                });
              })
            })
          });
        });
      });
    });
  });
});
