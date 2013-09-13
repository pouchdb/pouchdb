/*globals require  */

'use strict';

var PouchDB = require('../../');
var utils = require('../test.utils.js');
var opts = require('browserify-getopts');

var db1 = opts.db1 || 'testdb';
var test = require('wrapping-tape')(utils.setupDb(db1));

test('Create a Pouch', 1, function(t) {
  new PouchDB(db1, function(err, db) {
    t.ok(!err, 'Created');
  });
});

test('Remove a Pouch', 1, function(t) {
  new PouchDB(db1, function(err, db) {
    PouchDB.destroy(db1, function(err, db) {
      t.ok(!err, 'Deleted database');
    });
  });
});

test('Post a document', 1, function(t) {
  var db = new PouchDB(db1);
  db.post({a: 'doc'}, function(err, res) {
    t.notOk(err, 'No error posting docs');
  });
});

test('Modify a doc', 1, function(t) {
  var db = new PouchDB(db1);
  db.post({test: 'somestuff'}, function(err, info) {
    db.put({_id: info.id, _rev: info.rev, another: 'test'}, function(err, info2) {
      t.ok(!err && info2.rev !== info._rev, 'updated a doc with put');
    });
  });
});

test('Read db id', 1, function(t) {
  new PouchDB(db1, function(err, db) {
    t.equal(typeof db.id(), 'string', 'got db id');
  });
});

test('Close db', 1, function(t) {
  new PouchDB(db1, function(err, db) {
    db.close(function(err) {
      t.ok(!err, 'Close database');
    });
  });
});

test('Read db after closing', 2, function(t) {
  new PouchDB(db1, function(err, db) {
    t.equal(typeof db.id(), 'string', 'got db id');
    db.close(function(err) {
      new PouchDB(db1, function(err, db) {
        t.equal(typeof db.id(), 'string', 'got db id');
      });
    });
  });
});

test('Modify doc with incorrect rev', 1, function(t) {
  var db = new PouchDB(db1);
  db.post({a: 'doc'}, function(err, info) {
    var nDoc = {_id: info.id, _rev: info.rev + 'broken', another: 'test'};
    db.put(nDoc, function(err, info2) {
      t.ok(err, 'put was denied');
    });
  });
});

test('Remove doc', 1, function(t) {
  var db = new PouchDB(db1);
  db.put({_id: 'foo', value: 'test'}, function(err, res) {
    db.get('foo', function(err, doc) {
      db.remove(doc, function(err, res) {
        db.get('foo', {rev: res.rev}, function(err, doc) {
          t.deepEqual(doc, {_id: res.id, _rev: res.rev, _deleted: true},
                      'removal left only stub');
        });
      });
    });
  });
});

test('remove doc twice', 4, function(t) {
  var db = new PouchDB(db1);
  db.put({_id:"specifiedId", test:"somestuff"}, function(err, info) {
    db.get("specifiedId", function(err, doc) {
      t.ok(doc.test, "Put and got doc");
      db.remove(doc, function(err, response) {
        t.ok(!err, "Removed doc");
        db.put({_id:"specifiedId", test:"somestuff2"}, function(err, info) {
          db.get("specifiedId", function(err, doc){
            t.ok(doc, "Put and got doc again");
            db.remove(doc, function(err, response) {
              t.ok(!err, "Removed doc again");
            });
          });
        });
      });
    });
  });
});

test('Remove doc no callback', 1, function(t) {
  new PouchDB(db1, function(err, db) {
    var changes = db.changes({
      continuous: true,
      include_docs: true,
      onChange: function(change) {
        if (change.doc._deleted) {
          changes.cancel();
          t.ok(true, 'doc deleted');
        }
      }
    });

    db.post({_id:"somestuff"}, function (err, res) {
      db.remove({_id: res.id, _rev: res.rev});
    });
  });
});

test('Delete document without id', 1, function(t) {
  var db = new PouchDB(db1);
  db.remove({test: 'ing'}, function(err) {
    t.ok(err, 'failed to deleted');
  });
});

test('Bulk docs', 2, function(t) {
  var db = new PouchDB(db1);
  db.bulkDocs({docs: [{test:"somestuff"}, {test:"another"}]}, function(err, infos) {
    t.ok(!infos[0].error);
    t.ok(!infos[1].error);
  });
});

test('Basic checks', 6, function(t) {
  var db = new PouchDB(db1);
  db.info(function(err, info) {
    var updateSeq = info.update_seq;
    var doc = {_id: '0', a: 1, b:1};
    t.equal(info.doc_count, 0, 'No docs');
    db.put(doc, function(err, res) {
      t.equal(res.ok, true, 'Put was ok');
      db.info(function(err, info) {
        t.equal(info.doc_count, 1);
        t.notEqual(info.update_seq, updateSeq , 'update seq changed');
        db.get(doc._id, function(err, doc) {
          t.ok(doc._id === res.id && doc._rev === res.rev, 'revs right');
          db.get(doc._id, {revs_info: true}, function(err, doc) {
            t.equal(doc._revs_info[0].status, 'available', 'rev status');
          });
        });
      });
    });
  });
});

test('doc validation', 2, function(t) {
  var bad_docs = [
    {"_zing": 4},
    {"_zoom": "hello"},
    {"zane": "goldfish", "_fan": "something smells delicious"},
    {"_bing": {"wha?": "soda can"}}
  ];
  var db = new PouchDB(db1);
  db.bulkDocs({docs: bad_docs}, function(err, res) {
    t.equal(err.status, 500);
    t.equal(err.error, 'doc_validation');
  });
});

test('testing issue #48', 1, function(t) {
  var docs = [{"id":"0"}, {"id":"1"}, {"id":"2"}, {"id":"3"}, {"id":"4"}, {"id":"5"}];
  var x = 0;
  var timer;
  var db = new PouchDB(db1);
  var save = function() {
    db.bulkDocs({docs: docs}, function(err, res) {
      if (++x === 10) {
        clearInterval(timer);
        t.ok(true, 'all updated succedded');
      }
    });
  };
  timer = setInterval(save, 50);
});

test('Testing valid id', 1, function(t) {
  new PouchDB(db1, function(err, db) {
    db.post({'_id': 123, test: "somestuff"}, function (err, info) {
      t.ok(err, 'id must be a string');
    });
  });
});

test('put without _id should fail', 1, function(t) {
  var db = new PouchDB(db1);
  db.put({test:"somestuff"}, function(err, info) {
    t.ok(err, '_id is required');
  });
});

test('update_seq persists', 2, function(t) {
  var db = new PouchDB(db1);
  db.post({test: 'sometuff'}, function(err, info) {
    var newDb = new PouchDB(db1);
    newDb.info(function(err, info) {
      t.notEqual(info.update, 0, 'update seq');
      t.equal(info.doc_count, 1, 'doc count persists');
    });
  });
});

test('deletions persist', 1, function(t) {
  var doc = {_id: 'staticId', contents: 'stuff'};
  function writeAndDelete(db, cb) {
    db.put(doc, function(err, info) {
      db.remove({_id:info.id, _rev:info.rev}, cb);
    });
  }
  var db = new PouchDB(db1);
  writeAndDelete(db, function() {
    writeAndDelete(db, function() {
      db.put(doc, function() {
        db.get(doc._id, {conflicts: true}, function(err, details) {
          t.equal(false, '_conflicts' in details, 'Should not have conflicts');
        });
      });
    });
  });
});

test('Error when document is not an object', 5, function(t) {
  var doc1 = [{_id: 'foo'}, {_id: 'bar'}];
  var doc2 = "this is not an object";

  var callback = function(err, resp) {
    t.ok(err, 'doc must be an object');
  };

  var db = new PouchDB(db1);
  db.post(doc1, callback);
  db.post(doc2, callback);
  db.put(doc1, callback);
  db.put(doc2, callback);
  db.bulkDocs({docs: [doc1, doc2]}, callback);
});

test('test instance update_seq updates correctly', 2, function(t) {
  new PouchDB(db1, function(err, a) {
    new PouchDB(db1, function(err, b) {
      a.post({a: 'doc'}, function(err, info) {
        a.info(function(err, db1Info) {
          b.info(function(err, db2Info) {
            t.notEqual(db1Info.update_seq, 0, 'Update seqs arent 0');
            t.notEqual(db2Info.update_seq, 0, 'Update seqs arent 0');
          });
        });
      });
    });
  });
});