/*globals initTestDB: false, emit: true, generateAdapterUrl: false */
/*globals PERSIST_DATABASES: false, initDBPair: false, utils: true, strictEqual: false */
/*globals ajax: true, LevelPouch: true, makeDocs: false */
/*globals readBlob: false, makeBlob: false */
/*globals cleanupTestDatabases: false */

"use strict";

var adapters = ['local-1', 'http-1'];
var repl_adapters = [['local-1', 'http-1'],
                     ['http-1', 'http-2'],
                     ['http-1', 'local-1'],
                     ['local-1', 'local-2']];
var qunit = module;
var LevelPouch;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  Pouch = require('../src/pouch.js');
  LevelPouch = require('../src/adapters/pouch.leveldb.js');
  utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  qunit = QUnit.module;
}

adapters.map(function(adapter) {
  qunit('attachments: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
      Pouch.enableAllDbs = true;
    },
    teardown: cleanupTestDatabases
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

  // empty attachment
  var binAttDoc2 = {
    _id: "bin_doc2",
    _attachments:{
      "foo.txt": {
        content_type:"text/plain",
        data: ""
      }
    }
  };

  // json string doc
  var jsonDoc = {
    _id: 'json_doc',
    _attachments: {
      "foo.json": {
        content_type: "application/json",
        data: btoa('{"Hello":"world"}')
      }
    }
  };

  asyncTest("Test some attachments", function() {
    var db;
    initTestDB(this.name, function(err, _db) {
      db = _db;
      db.put(binAttDoc, function(err, write) {
        ok(!err, 'saved doc with attachment');
        db.get('bin_doc', function(err, doc) {
          ok(doc._attachments, 'doc has attachments field');
          ok(doc._attachments['foo.txt'], 'doc has attachment');
          equal(doc._attachments['foo.txt'].content_type, 'text/plain', 'doc has correct content type');
          db.get('bin_doc/foo.txt', function(err, res) {
            readBlob(res, function(data) {
              equal(data, 'This is a base64 encoded text',
                'Correct data returned');
              db.put(binAttDoc2, function(err, rev) {
                db.get('bin_doc2/foo.txt', function(err, res, xhr) {
                  readBlob(res, function(data) {
                    equal(data, '', 'Correct data returned');
                    moreTests(rev.rev);
                  });
                });
              });
            });
          });
        });
      });
    });

    function moreTests(rev) {
      var blob = makeBlob('This is no base64 encoded text');
      db.putAttachment('bin_doc2/foo2.txt', rev, blob, 'text/plain', function() {
        db.get('bin_doc2/foo2.txt', function(err, res, xhr) {
          readBlob(res, function(data) {
            ok(data === 'This is no base64 encoded text',
              'Correct data returned');
            db.get('bin_doc2', {attachments: true}, function(err, res, xhr) {
              ok(res._attachments, 'Result has attachments field');
              equal(res._attachments['foo2.txt'].data,
                btoa('This is no base64 encoded text'));
              equal(res._attachments['foo2.txt'].content_type, 'text/plain',
                'Attachment was stored with correct content type');
              equal(res._attachments['foo.txt'].data, '');
              start();
            });
          });
        });
      });
    }
  });

  asyncTest("Testing with invalid docs", function() {
    var invalidDoc = {'_id': '_invalid', foo: 'bar'};
    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [invalidDoc, binAttDoc]}, function(err, info) {
        ok(err, 'bad request');
        start();
      });
    });
  });

  asyncTest("Test create attachment and doc in one go", function() {
    initTestDB(this.name, function(err, db) {
      var blob = makeBlob('Mytext');
      db.putAttachment('anotherdoc/mytext', blob, 'text/plain', function(err, res) {
        ok(res.ok);
        start();
      });
    });
  });

  asyncTest("Test create attachment and doc in one go without callback", function() {
    initTestDB(this.name, function(err, db) {
      var changes = db.changes({
        continuous: true,
        onChange: function(change){
          if (change.seq === 1){
            equal(change.id, 'anotherdoc2', 'Doc has been created');
            db.get(change.id, {attachments: true}, function(err, doc) {
              equal(typeof doc._attachments, 'object', 'doc has attachments object');
              ok(doc._attachments.mytext, 'doc has attachments attachment');
              equal(doc._attachments.mytext.data, btoa('Mytext'), 'doc has attachments attachment');
              changes.cancel();
              start();
            });
          }
        }
      });
      var blob = makeBlob('Mytext');
      db.putAttachment('anotherdoc2/mytext', blob, 'text/plain');
    });
  });

  asyncTest("Test create attachment without callback", function() {
    initTestDB(this.name, function(err, db) {
      db.put({ _id: 'anotherdoc3' }, function(err, resp) {
        ok(!err, 'doc was saved');
        var changes = db.changes({
          continuous: true,
          include_docs: true,
          onChange: function(change){
            if (change.seq === 2){
              equal(change.id, 'anotherdoc3', 'Doc has been created');
              db.get(change.id, {attachments: true}, function(err, doc) {
                equal(typeof doc._attachments, 'object', 'doc has attachments object');
                ok(doc._attachments.mytext, 'doc has attachments attachment');
                equal(doc._attachments.mytext.data, btoa('Mytext'), 'doc has attachments attachment');
                changes.cancel();
                start();
              });
            }
          }
        });
        var blob = makeBlob('Mytext');
        db.putAttachment('anotherdoc3/mytext', resp.rev, blob, 'text/plain');
      });
    });
  });


  asyncTest("Test put attachment on a doc without attachments", function() {
    initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        var blob = makeBlob('Mytext');
        db.putAttachment('mydoc/mytext', resp.rev, blob, 'text/plain', function(err, res) {
          ok(res.ok);
          start();
        });
      });
    });
  });

  asyncTest("Testing with invalid rev", function() {
    initTestDB(this.name, function(err, db) {
      var doc = {_id: 'adoc'};
      db.put(doc, function(err, resp) {
        ok(!err, 'Doc has been saved');
        doc._rev = resp.rev;
        doc.foo = 'bar';
        db.put(doc, function(err, resp) {
          ok(!err, 'Doc has been updated');
          var blob = makeBlob('bar');
          db.putAttachment('adoc/foo.txt', doc._rev, blob, 'text/plain', function(err) {
            ok(err, 'Attachment has not been saved');
            equal(err.error, 'conflict', 'error is a conflict');
            start();
          });
        });
      });
    });
  });

  asyncTest("Test delete attachment from a doc", function() {
    initTestDB(this.name, function(erro, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        var blob = makeBlob('Mytext');
        db.putAttachment('mydoc/mytext', resp.rev, blob, 'text/plain', function(err, res) {
          ok(res.ok);
          var rev = res.rev;
          db.removeAttachment('mydoc/mytext', 0, function(err, res) {
            ok(err);
            db.removeAttachment('mydoc/mytext', rev, function(err, res) {
              ok(res.ok);
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test a document with a json string attachment", function() {
    initTestDB(this.name, function(err, db) {
      db.put(jsonDoc, function(err, results) {
        ok(!err, 'saved doc with attachment');
        db.get(results.id, function(err, doc) {
          ok(!err, 'fetched doc');
          ok(doc._attachments, 'doc has attachments field');
          ok(doc._attachments['foo.json'], 'doc has attachment');
          equal(doc._attachments['foo.json'].content_type, 'application/json', 'doc has correct content type');
          db.get(results.id + '/' + 'foo.json', function(err, attachment) {
            readBlob(attachment, function(data) {
              equal(data, atob(jsonDoc._attachments['foo.json'].data),
                'correct data');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test remove doc with attachment", function() {
    initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        var blob = makeBlob('Mytext');
        db.putAttachment('mydoc/mytext', resp.rev, blob, 'text/plain', function(err, res) {
          db.get('mydoc',{attachments:false},function(err,doc){
            db.remove(doc, function(err, resp){
              ok(res.ok);
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Insert a doc with a / in the _id", function() {
    initTestDB(this.name, function(err, db) {
      ok(!err, 'opened the pouch');
      var doc = {_id: 'doc/attachment', test: true};
      db.put(doc, function(err, info) {
        ok(!err, 'saved doc');
        equal(info.id, 'doc', '_id got truncated');
        db.get('doc', {attachments: true}, function(err, doc2) {
          ok(!err, 'retreived the doc');
          ok(doc2._attachments['attachment'], 'it has the attachment');
          equal(doc2._attachments['attachment'].data, btoa(JSON.stringify(doc)),
             'the attachment matches the original doc');

          db.get('doc/attachment', function(err, response) {
            ok(!err, 'got the attachment');
            readBlob(response, function(data) {
              equal(data, JSON.stringify(doc),
                    'the attachment is returned as a JSON string');
              var obj = JSON.parse(data);
              equal(obj._id, doc._id, 'id matches');
              equal(obj.test, doc.test, 'test matches');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Try to insert a doc with unencoded attachment", function() {
    initTestDB(this.name, function(err, db) {
      var doc = {
        _id: "foo",
        _attachments: {
          "foo.txt": {
            content_type: "text/plain",
            data: "this should have been encoded!"
          }
        }
      };
      db.put(doc, function(err, res) {
        console.log(err);

        ok(err, "error returned");
        strictEqual(err.status, 500, "correct error");
        strictEqual(err.error, "badarg", "correct error");
        start();
      });
    });
  });
});


repl_adapters.map(function(adapters) {

  qunit('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = generateAdapterUrl(adapters[0]);
      this.remote = generateAdapterUrl(adapters[1]);
    }
  });


    asyncTest("Attachments replicate", function() {
        console.info('Starting Test: Attachments replicate');

        var binAttDoc = {
          _id: "bin_doc",
          _attachments:{
            "foo.txt": {
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

        initDBPair(this.name, this.remote, function(db, remote) {
          remote.bulkDocs({docs: docs1}, function(err, info) {
            var replicate = db.replicate.from(remote, function() {
              db.get('bin_doc', {attachments: true}, function(err, doc) {
                equal(binAttDoc._attachments['foo.txt'].data,
                      doc._attachments['foo.txt'].data);
                start();
              });
            });
          });
        });
    });



});
