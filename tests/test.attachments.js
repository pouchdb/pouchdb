['idb-1', 'http-1'].map(function(adapter) {

  module('attachments: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    }
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
  }

  asyncTest("Test some attachments", function() {
    var db;
    initTestDB(this.name, function(err, _db) {
      db = _db;
      db.put(binAttDoc, function(err, write) {
        ok(!err, 'saved doc with attachment');
        db.get('bin_doc/foo.txt', function(err, res) {
          ok(res === 'This is a base64 encoded text', 'Correct data returned');
          db.put(binAttDoc2, function(err, rev) {
            db.get('bin_doc2/foo.txt', function(err, res, xhr) {
              ok(res === '', 'Correct data returned');
              moreTests(rev.rev);
            });
          });
        });
      });
    });

    function moreTests(rev) {
      var ndoc = 'This is no base64 encoded text';
      db.putAttachment('bin_doc2/foo2.txt', rev, ndoc, "text/plain", function() {
        db.get('bin_doc2/foo2.txt', function(err, res, xhr) {
          ok(res === 'This is no base64 encoded text', 'Correct data returned');
          db.get('bin_doc2', {attachments: true}, function(err, res, xhr) {
            ok(res._attachments, 'Result has attachments field');
            equal(res._attachments['foo2.txt'].data,
                  btoa('This is no base64 encoded text'));
            equal(res._attachments['foo.txt'].data, '');
            start();
          });
        });
      });
    };

  });

  asyncTest("Test put attachment on a doc without attachments", function() {
    initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        db.putAttachment('mydoc/mytext', resp.rev, 'Mytext', 'text/plain', function(err, res) {
          ok(res.ok);
          start();
        })
      });
    });
  });

  asyncTest("Test remove doc with attachment", function() {
    initTestDB(this.name, function(err, db) {
      db.put({ _id: 'mydoc' }, function(err, resp) {
        db.putAttachment('mydoc/mytext', resp.rev, 'Mytext', 'text/plain', function(err, res) {
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
