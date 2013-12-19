"use strict";

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

var db1 = testUtils.args('db1') || 'test_db';
var db2 = testUtils.args('db2') || 'test_db2';

QUnit.module("basics", {
  setup: testUtils.cleanDbs(QUnit, [db1, db2]),
  teardown: testUtils.cleanDbs(QUnit, [db1, db2])
});

var binAttDoc = {
  _id: "bin_doc",
  _attachments:{
    "foo.txt": {
      content_type:"text/plain",
      data: "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
    }
  }
};

asyncTest('Insert a doc, putAttachment and allDocs', function() {
  new PouchDB(db1, function(err, db) {
    ok(!err, 'opened the pouch');
    var docId = 'doc/with/slashes';
    var attachmentId = 'attachment/with/slashes';
    var blobData = 'attachment content';
    var blob = testUtils.makeBlob(blobData);
    var doc = {_id: docId, test: true};
    db.put(doc, function(err, info) {
      ok(!err, 'saved doc');
      strictEqual(info.id, 'doc/with/slashes', 'id is the same as inserted');
      db.putAttachment(docId, attachmentId, info.rev, blob, 'text/plain', function(err, res) {
        db.getAttachment(docId, attachmentId, function(err, res) {
          testUtils.readBlob(res, function(data) {
            db.get(docId, function(err, res){
              strictEqual(res._id, docId);
              ok(attachmentId in res._attachments, 'contains correct attachment');
              start();
            });
          });
        });
      });
    });
  });
});

asyncTest('BulkDocs and changes', function() {
  new PouchDB(db1, function(err, db) {
    var docs = [
      {_id: 'part/doc1', int: 1},
      {_id: 'part/doc2', int: 2, _attachments: {
        'attachment/with/slash': {
          content_type: 'text/plain',
          data: 'c29tZSBkYXRh'
        }
      }},
      {_id: 'part/doc3', int: 3}
    ];
    db.bulkDocs({docs: docs}, function(err, res) {
      for(var i = 0; i < 3; i++){
        strictEqual(res[i].ok, true, 'correctly inserted ' + docs[i]._id);
      }
      db.allDocs({include_docs: true, attachments: true}, function(err, res) {
        res.rows.sort(function(a, b){return a.doc.int - b.doc.int;});
        for(var i = 0; i < 3; i++){
          strictEqual(res.rows[i].doc._id, docs[i]._id, '(allDocs) correctly inserted ' + docs[i]._id);
        }
        strictEqual('attachment/with/slash' in res.rows[1].doc._attachments, true, 'doc2 has attachment');
        db.changes({
          complete: function(err, res) {
            res.results.sort(function(a, b){return a.id.localeCompare(b.id);});
            for(var i = 0; i < 3; i++){
              strictEqual(res.results[i].id, docs[i]._id, '(changes) correctly inserted ' + docs[i]._id);
            }
            start();
          }
        });
      });
    });
  });
});

asyncTest("Attachments replicate", function() {
  var binAttDoc = {
    _id: "bin_doc/with/slash",
    _attachments:{
      "foo/with/slash.txt": {
        content_type:"text/plain",
        data: "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
      }
    }
  };

  var docs1 = [
    binAttDoc,
    {_id: "0", integer: 0},
    {_id: "1", integer: 1},
    {_id: "2", integer: 2},
    {_id: "3", integer: 3}
  ];

  new PouchDB(db1, function(err, db) {
    var remote = new PouchDB(db2);
    remote.bulkDocs({docs: docs1}, function(err, info) {
      var replicate = db.replicate.from(remote, function() {
        db.get('bin_doc/with/slash', {attachments: true}, function(err, doc) {
          equal(binAttDoc._attachments['foo/with/slash.txt'].data,
                doc._attachments['foo/with/slash.txt'].data);
          start();
        });
      });
    });
  });
});
