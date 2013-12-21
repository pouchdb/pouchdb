"use strict";

var adapters = ['local-1', 'http-1'];
var repl_adapters = [['local-1', 'http-1'],
                     ['http-1', 'http-2'],
                     ['http-1', 'local-1'],
                     ['local-1', 'local-2']];

if (typeof module !== undefined && module.exports) {
  var PouchDB = require('../lib');
  var testUtils = require('./test.utils.js');
}

adapters.map(function(adapter) {
  QUnit.module('attachments: ' + adapter, {
    setup : function () {
      this.name = testUtils.generateAdapterUrl(adapter);
      PouchDB.enableAllDbs = true;
    },
    teardown: testUtils.cleanupTestDatabases
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
        data: 'eyJIZWxsbyI6IndvcmxkIn0='
      }
    }
  };

  var pngAttDoc = {
    _id: "png_doc",
    _attachments: {
      "foo.png": {
        content_type: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAMFBMVEX+9+j+9OD+7tL95rr93qT80YD7x2L6vkn6syz5qRT4ogT4nwD4ngD4nQD4nQD4nQDT2nT/AAAAcElEQVQY002OUQLEQARDw1D14f7X3TCdbfPnhQTqI5UqvGOWIz8gAIXFH9zmC63XRyTsOsCWk2A9Ga7wCXlA9m2S6G4JlVwQkpw/YmxrUgNoMoyxBwSMH/WnAzy5cnfLFu+dK2l5gMvuPGLGJd1/9AOiBQiEgkzOpgAAAABJRU5ErkJggg=="
      }
    }
  };

  asyncTest("Test some attachments", function() {
    var db;
    testUtils.initTestDB(this.name, function(err, _db) {
      db = _db;
      db.put(binAttDoc, function(err, write) {
        ok(!err, 'saved doc with attachment');
        db.get('bin_doc', function(err, doc) {
          ok(doc._attachments, 'doc has attachments field');
          ok(doc._attachments['foo.txt'], 'doc has attachment');
          equal(doc._attachments['foo.txt'].content_type, 'text/plain',
                'doc has correct content type');
          db.getAttachment('bin_doc', 'foo.txt', function(err, res) {
            testUtils.readBlob(res, function(data) {
              strictEqual(data, 'This is a base64 encoded text', 'Correct data returned');
              db.put(binAttDoc2, function(err, rev) {
                db.getAttachment('bin_doc2', 'foo.txt', function(err, res, xhr) {
                  testUtils.readBlob(res, function(data) {
                    strictEqual(data, '', 'Correct data returned');
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
      var blob = testUtils.makeBlob('This is no base64 encoded text');
      db.putAttachment('bin_doc2', 'foo2.txt', rev, blob, 'text/plain', function(err, wtf) {
        db.getAttachment('bin_doc2', 'foo2.txt', function(err, res, xhr) {
          testUtils.readBlob(res, function(data) {
            ok(data, 'This is no base64 encoded text', 'Correct data returned');
            db.get('bin_doc2', {attachments: true}, function(err, res, xhr) {
              ok(res._attachments, 'Result has attachments field');
              ok(!res._attachments['foo2.txt'].stub, 'stub is false');
              equal(res._attachments['foo2.txt'].data,
                    "VGhpcyBpcyBubyBiYXNlNjQgZW5jb2RlZCB0ZXh0");
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

  asyncTest("Test getAttachment", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put(binAttDoc, function(err, res) {
        db.getAttachment('bin_doc', 'foo.txt', function(err, res) {
          ok(!err, "Attachment read");
          testUtils.readBlob(res, function(data) {
            strictEqual(data, "This is a base64 encoded text", "correct data");
            start();
          });
        });
      });
    });
  });

  asyncTest("Test attachments in allDocs/changes", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      var docs = [
        {
          _id: 'doc0'
        },
        {
          _id: 'doc1',
          _attachments: {
            'att0': {
              data: "YXR0YWNobWVudDA=",
              content_type: 'text/plain'
            }
          }
        },
        {
          _id: 'doc2',
          _attachments: {
            'att0': {
              data: "YXR0YWNobWVudDA=",
              content_type: 'text/plain'
            },
            'att1': {
              data: "YXR0YWNobWVudDE=",
              content_type: 'text/plain'
            }
          }
        }
      ];
      function sort(a, b){
        return a.id.localeCompare(b.id);
      }
      db.bulkDocs({docs: docs}, function(err, res) {
        db.allDocs({include_docs: true}, function(err, res){
          for(var i = 0; i < 3; i++){
            for(var j = 0; j < i; j++){
              strictEqual(res.rows[i].doc._attachments['att' + j].stub, true, '(allDocs) doc'+i+' contains att'+j+' stub');
            }
          }
          strictEqual(res.rows[0].doc._attachments, undefined, '(allDocs) doc0 contains no attachments');
          db.changes({
            include_docs: true,
            onChange: function(change) {
              var i = +change.id.substr(3);
              if (i === 0) {
                strictEqual(res.rows[0].doc._attachments, undefined, '(onChange) doc0 contains no attachments');
              } else {
                for(var j = 0; j < i; j++){
                  strictEqual(res.rows[i].doc._attachments['att' + j].stub, true, '(onChange) doc'+i+' contains att'+j+' stub');
                }
              }
            },
            complete: function(err, res) {
              res.results.sort(sort);
              for(var i = 0; i < 3; i++){
                for(var j = 0; j < i; j++){
                  strictEqual(res.results[i].doc._attachments['att' + j].stub, true, '(complete) doc'+i+' contains att'+j+' stub');
                }
              }
              strictEqual(res.results[0].doc._attachments, undefined, '(complete) doc0 contains no attachments');
              start();
            }
          });
        });
      });
    });
  });

  asyncTest("Test getAttachment with PNG", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put(pngAttDoc, function(err, res) {
        db.getAttachment('png_doc', 'foo.png', function(err, res) {
          ok(!err, "Attachment read");
          testUtils.base64Blob(res, function(data) {
            strictEqual(data, pngAttDoc._attachments['foo.png'].data,
                        "correct data");
            start();
          });
        });
      });
    });
  });

  asyncTest("Testing with invalid docs", function() {
    var invalidDoc = {'_id': '_invalid', foo: 'bar'};
    testUtils.initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [invalidDoc, binAttDoc]}, function(err, info) {
        ok(err, 'bad request');
        start();
      });
    });
  });

  asyncTest("Test create attachment and doc in one go", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      var blob = testUtils.makeBlob('Mytext');
      db.putAttachment('anotherdoc', 'mytext', blob, 'text/plain', function(err, res) {
        ok(res.ok);
        start();
      });
    });
  });

  asyncTest("Test create attachment and doc in one go without callback", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      var changes = db.changes({
        continuous: true,
        onChange: function(change){
          if (change.seq === 1){
            equal(change.id, 'anotherdoc2', 'Doc has been created');
            db.get(change.id, {attachments: true}, function(err, doc) {
              equal(typeof doc._attachments, 'object', 'doc has attachments object');
              ok(doc._attachments.mytext, 'doc has attachments attachment');
              equal(doc._attachments.mytext.data,
                    "TXl0ZXh0", 'doc has attachments attachment');
              changes.cancel();
              start();
            });
          }
        }
      });
      var blob = testUtils.makeBlob('Mytext');
      db.putAttachment('anotherdoc2', 'mytext', blob, 'text/plain');
    });
  });

  asyncTest("Test create attachment without callback", function() {
    testUtils.initTestDB(this.name, function(err, db) {
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
                equal(doc._attachments.mytext.data,
                      "TXl0ZXh0", 'doc has attachments attachment');
                changes.cancel();
                start();
              });
            }
          }
        });
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('anotherdoc3', 'mytext', resp.rev, blob, 'text/plain');
      });
    });
  });


  asyncTest("Test put attachment on a doc without attachments", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', resp.rev, blob, 'text/plain', function(err, res) {
          ok(res.ok);
          start();
        });
      });
    });
  });

  asyncTest("Testing with invalid rev", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      var doc = {_id: 'adoc'};
      db.put(doc, function(err, resp) {
        ok(!err, 'Doc has been saved');
        doc._rev = resp.rev;
        doc.foo = 'bar';
        db.put(doc, function(err, resp) {
          ok(!err, 'Doc has been updated');
          var blob = testUtils.makeBlob('bar');
          db.putAttachment('adoc', 'foo.txt', doc._rev, blob, 'text/plain', function(err) {
            ok(err, 'Attachment has not been saved');
            equal(err.name, 'conflict', 'error is a conflict');
            start();
          });
        });
      });
    });
  });

  asyncTest('Test get with attachments: true if empty attachments', function() {
    testUtils.initTestDB(this.name, function(erro, db) {
      db.put({_id: 'foo', _attachments: {}}, function(err, resp) {
        db.get('foo', {attachments: true}, function(err, res) {
          strictEqual(res._id, 'foo');
          start();
        });
      });
    });
  });

  asyncTest("Test delete attachment from a doc", function() {
    testUtils.initTestDB(this.name, function(erro, db) {
      db.put({_id: 'mydoc', _attachments: {
        'mytext1': {
          content_type: 'text/plain',
          data: "TXl0ZXh0MQ=="
        },
        'mytext2': {
          content_type: 'text/plain',
          data: "TXl0ZXh0Mg=="
        }
      }}, function(err, res) {
        var rev = res.rev;
        db.get('mydoc', {attachments: true}, function(err, res) {
          ok('mytext1' in res._attachments, 'attachment 1 correctly added');
          ok('mytext1' in res._attachments, 'attachment 2 correctly added');
          db.removeAttachment('mydoc', 'mytext1', 0, function(err, res) {
            ok(err, 'removal should fail due to broken rev');
            db.removeAttachment('mydoc', 'mytext1', rev, function(err, res) {
              db.get('mydoc', {attachments: true}, function(err, res) {
                ok(!('mytext1' in res._attachments), 'attachment 1 correctly removed');
                ok('mytext2' in res._attachments, 'attachment 2 still there');
                db.removeAttachment('mydoc', 'mytext2', res._rev, function(err, res) {
                  ok(res._attachments === undefined || !('mytext1' in res._attachments), 'attachment 1 correctly removed');
                  ok(res._attachments === undefined || !('mytext2' in res._attachments), 'attachment 2 correctly removed');
                  start();
                });
              });
            });
          });
        });
      });
    });
  });

  asyncTest("Test a document with a json string attachment", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put(jsonDoc, function(err, results) {
        ok(!err, 'saved doc with attachment');
        db.get(results.id, function(err, doc) {
          ok(!err, 'fetched doc');
          ok(doc._attachments, 'doc has attachments field');
          ok(doc._attachments['foo.json'], 'doc has attachment');
          equal(doc._attachments['foo.json'].content_type, 'application/json', 'doc has correct content type');
          db.getAttachment(results.id, 'foo.json', function(err, attachment) {
            testUtils.readBlob(attachment, function(data) {
              equal("eyJIZWxsbyI6IndvcmxkIn0=", jsonDoc._attachments['foo.json'].data,
                'correct data');
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test remove doc with attachment", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', resp.rev, blob, 'text/plain', function(err, res) {
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

  asyncTest("Try to insert a doc with unencoded attachment", function() {
    testUtils.initTestDB(this.name, function(err, db) {
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
        ok(err, "error returned");
        strictEqual(err.status, 500, "correct error");
        strictEqual(err.name, "badarg", "correct error");
        start();
      });
    });
  });

  asyncTest("Try to get attachment of unexistent doc", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.getAttachment('unexistent', 'attachment', function(err, res) {
        ok(err, "Correctly returned error");
        start();
      });
    });
  });

  asyncTest("Test synchronous getAttachment", function() {
    var db = new PouchDB(this.name);
    db.getAttachment('unexistent', 'attachment', function(err, res) {
      ok(err, "Correctly returned error");
      start();
    });
  });

  asyncTest("Test synchronous putAttachment", function() {
    var db = new PouchDB(this.name);
    db.putAttachment('a', 'foo2.txt', '', '', 'text/plain', function(err) {
      ok(!err, "Correctly wrote attachment");
      start();
    });
  });

  asyncTest("Test stubs", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.putAttachment('a', 'foo2.txt', '', '', 'text/plain', function(err) {
        db.allDocs({include_docs: true}, function(err, docs) {
          ok(!docs.rows[0].stub, 'no stub');
          start();
        });
      });
    });
  });

  asyncTest("Try to get unexistent attachment of some doc", function() {
    testUtils.initTestDB(this.name, function(err, db) {
      db.put({_id: "foo"}, function(err, res) {
        ok(!err, "doc inserted");
        db.getAttachment('foo', 'unexistentAttachment', function(err, res) {
          ok(err, "Correctly returned error");
          start();
        });
      });
    });
  });
});


repl_adapters.map(function(adapters) {

  QUnit.module('replication: ' + adapters[0] + ':' + adapters[1], {
    setup : function () {
      this.name = testUtils.generateAdapterUrl(adapters[0]);
      this.remote = testUtils.generateAdapterUrl(adapters[1]);
    }
  });

  asyncTest("Attachments replicate", function() {
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

    testUtils.initDBPair(this.name, this.remote, function(db, remote) {
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
