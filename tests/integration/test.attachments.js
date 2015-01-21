'use strict';

var adapters = ['local', 'http'];
var repl_adapters = [
  ['local', 'http'],
  ['http', 'http'],
  ['http', 'local'],
  ['local', 'local']
];

/* jshint maxlen:false */
var icons = [
  "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"
];

var iconDigests = [
  "md5-Mf8m9ehZnCXC717bPkqkCA==",
  "md5-fdEZBYtnvr+nozYVDzzxpA==",
  "md5-ImDARszfC+GA3Cv9TVW4HA==",
  "md5-hBsgoz3ujHM4ioa72btwow==",
  "md5-jDUyV6ySnTVANn2qq3332g=="
];

var iconLengths = [1047, 789, 967, 527, 1108];

adapters.forEach(function (adapter) {
  describe('test.attachments.js-' + adapter, function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapter, 'testdb');
      testUtils.cleanup([dbs.name], done);
    });

    after(function (done) {
      testUtils.cleanup([dbs.name], done);
    });

    var binAttDoc = {
      _id: 'bin_doc',
      _attachments: {
        'foo.txt': {
          content_type: 'text/plain',
          data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
        }
      }
    };
    // empty attachment
    var binAttDoc2 = {
      _id: 'bin_doc2',
      _attachments: {
        'foo.txt': {
          content_type: 'text/plain',
          data: ''
        }
      }
    };
    // json string doc
    var jsonDoc = {
      _id: 'json_doc',
      _attachments: {
        'foo.json': {
          content_type: 'application/json',
          data: 'eyJIZWxsbyI6IndvcmxkIn0='
        }
      }
    };
    var pngAttDoc = {
      _id: 'png_doc',
      _attachments: {
        'foo.png': {
          content_type: 'image/png',
          data: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAMFBMVEX+9+' +
                'j+9OD+7tL95rr93qT80YD7x2L6vkn6syz5qRT4ogT4nwD4ngD4nQD4nQD4' +
                'nQDT2nT/AAAAcElEQVQY002OUQLEQARDw1D14f7X3TCdbfPnhQTqI5UqvG' +
                'OWIz8gAIXFH9zmC63XRyTsOsCWk2A9Ga7wCXlA9m2S6G4JlVwQkpw/Ymxr' +
                'UgNoMoyxBwSMH/WnAzy5cnfLFu+dK2l5gMvuPGLGJd1/9AOiBQiEgkzOpg' +
                'AAAABJRU5ErkJggg=='
        }
      }
    };

    it('issue 2803 should throw 412', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        doc._attachments['bar.txt'] = {
          stub: true,
          digest: 'md5-sorryIDoNotReallyExist=='
        };
        return db.put(doc);
      }).then(function (res) {
        should.not.exist(res, 'should throw');
      }).catch(function (err) {
        should.exist(err.status, 'got improper error: ' + err);
        err.status.should.equal(412);
      });
    });

    it('issue 2803 should throw 412 part 2', function () {
      var stubDoc = {
        _id: 'stubby',
        "_attachments": {
          "foo.txt": {
            "content_type": "text/plain",
            "digest": "md5-aEI7pOYCRBLTRQvvqYrrJQ==",
            "stub": true
          },
        }
      };
      var db = new PouchDB(dbs.name);
      return db.put(stubDoc).then(function (res) {
        should.not.exist(res, 'should throw');
      }).catch(function (err) {
        should.exist(err.status, 'got improper error: ' + err);
        err.status.should.equal(412, 'got improper error: ' + err);
      });
    });

    it('issue 2803 should throw 412 part 3', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        doc._attachments['foo.json'] = jsonDoc._attachments['foo.json'];
      }).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        doc._attachments['bar.txt'] = {
          stub: true,
          digest: 'md5-sorryIDoNotReallyExist=='
        };
        return db.put(doc);
      }).then(function (res) {
        should.not.exist(res, 'should throw');
      }).catch(function (err) {
        should.exist(err.status, 'got improper error: ' + err);
        err.status.should.equal(412);
      });
    });

    it('issue 2803 should throw 412 part 4', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        doc._attachments['foo.json'] = jsonDoc._attachments['foo.json'];
      }).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        doc._attachments['bar.txt'] = {
          stub: true,
          digest: 'md5-sorryIDoNotReallyExist=='
        };
        doc._attachments['baz.txt'] = {
          stub: true,
          digest: 'md5-yahNoIDoNotExistEither=='
        };
        return db.put(doc);
      }).then(function (res) {
        should.not.exist(res, 'should throw');
      }).catch(function (err) {
        should.exist(err.status, 'got improper error: ' + err);
        err.status.should.equal(412);
      });
    });

    it('Measures length correctly after put()', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        delete doc._attachments["foo.txt"].revpos;

        // because of libicu vs. ascii
        var digest = doc._attachments["foo.txt"].digest;
        var validDigests = [
          "md5-qUUYqS41RhwF0TrCsTAxFg==",
          "md5-aEI7pOYCRBLTRQvvqYrrJQ==",
          "md5-jeLnIuUvK7d+6gya044lVA=="
        ];
        validDigests.indexOf(digest).should.not.equal(-1,
          'expected ' + digest  + ' to be in: ' +
            JSON.stringify(validDigests));
        delete doc._attachments["foo.txt"].digest;
        doc._attachments.should.deep.equal({
          "foo.txt": {
            "content_type": "text/plain",
            "stub": true,
            length: 29
          }
        });
      });
    });

    it('#3074 non-live changes()', function () {
      // blocked on COUCHDB-2519
      if (testUtils.isCouchMaster()) {
        return true;
      }
      
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'foo.png': {
              data: icons[i],
              content_type: 'image/png'
            }
          }
        });
      }
      return db.bulkDocs(docs).then(function () {
        return db.changes({include_docs: true, attachments: true});
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "foo.png": {
              "content_type": "image/png",
              "data": icon,
              "digest": iconDigests[i]
            }
          };
        }), 'when attachments=true');
        return db.changes({include_docs: true});
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments['foo.png'];
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "content_type": "image/png",
            stub: true,
            "digest": iconDigests[i],
            length: iconLengths[i]
          };
        }), 'when attachments=false');
        return db.changes({attachments: true});
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=true but include_docs=false');
        });
        return db.changes();
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=false and include_docs=false');
        });
      });
    });

    it('#3074 live changes()', function () {
      // blocked on COUCHDB-2519
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name);

      function liveChangesPromise(opts) {
        opts.live = true;
        return new PouchDB.utils.Promise(function (resolve, reject) {
          var retChanges = {results: []};
          var changes = db.changes(opts)
            .on('change', function (change) {
              retChanges.results.push(change);
              if (retChanges.results.length === 5) {
                changes.cancel();
                resolve(retChanges);
              }
            }).on('error', reject);
        });
      }

      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'foo.png': {
              data: icons[i],
              content_type: 'image/png'
            }
          }
        });
      }
      return db.bulkDocs(docs).then(function () {
        return liveChangesPromise({
          include_docs: true,
          attachments: true
        });
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "foo.png": {
              "content_type": "image/png",
              "data": icon,
              "digest": iconDigests[i]
            }
          };
        }), 'when attachments=true');
        return liveChangesPromise({include_docs: true});
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments['foo.png'];
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "content_type": "image/png",
            stub: true,
            "digest": iconDigests[i],
            length: iconLengths[i]
          };
        }), 'when attachments=false');
        return liveChangesPromise({attachments: true});
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=true but include_docs=false');
        });
        return liveChangesPromise({});
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=false and include_docs=false');
        });
      });
    });

    it('#3074 non-live changes(), no attachments', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString()
        });
      }
      return db.bulkDocs(docs).then(function () {
        return db.changes({include_docs: true, attachments: true});
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          return !!doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return false;
        }), 'when attachments=true');
        return db.changes({include_docs: true});
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          return !!doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return false;
        }), 'when attachments=false');
        return db.changes({attachments: true});
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=true but include_docs=false');
        });
        return db.changes();
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=false and include_docs=false');
        });
      });
    });

    it('#3074 live changes(), no attachments', function () {

      var db = new PouchDB(dbs.name);

      function liveChangesPromise(opts) {
        opts.live = true;
        return new PouchDB.utils.Promise(function (resolve, reject) {
          var retChanges = {results: []};
          var changes = db.changes(opts)
            .on('change', function (change) {
              retChanges.results.push(change);
              if (retChanges.results.length === 5) {
                changes.cancel();
                resolve(retChanges);
              }
            }).on('error', reject);
        });
      }

      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString()
        });
      }
      return db.bulkDocs(docs).then(function () {
        return liveChangesPromise({
          include_docs: true,
          attachments: true
        });
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          return !!doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return false;
        }), 'when attachments=true');
        return liveChangesPromise({include_docs: true});
      }).then(function (res) {
        var attachments = res.results.sort(function (left, right) {
          return left.id < right.id ? -1 : 1;
        }).map(function (change) {
          var doc = change.doc;
          return !!doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return false;
        }), 'when attachments=false');
        return liveChangesPromise({attachments: true});
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=true but include_docs=false');
        });
        return liveChangesPromise({});
      }).then(function (res) {
        res.results.should.have.length(5);
        res.results.forEach(function (row) {
          should.not.exist(row.doc,
            'no doc when attachments=false and include_docs=false');
        });
      });
    });

    it('#2771 allDocs() 1, single attachment', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.allDocs({key: binAttDoc._id, include_docs: true});
      }).then(function (res) {
        var doc = res.rows[0].doc;
        delete doc._attachments["foo.txt"].revpos;

        // because of libicu vs. ascii
        var digest = doc._attachments["foo.txt"].digest;
        var validDigests = [
          "md5-qUUYqS41RhwF0TrCsTAxFg==",
          "md5-aEI7pOYCRBLTRQvvqYrrJQ==",
          "md5-jeLnIuUvK7d+6gya044lVA=="
        ];
        validDigests.indexOf(digest).should.not.equal(-1,
          'expected ' + digest  + ' to be in: ' +
          JSON.stringify(validDigests));
        delete doc._attachments["foo.txt"].digest;
        doc._attachments.should.deep.equal({
          "foo.txt": {
            "content_type": "text/plain",
            "stub": true,
            length: 29
          }
        });
        return db.allDocs({
          key: binAttDoc._id,
          include_docs: true,
          attachments: true
        });
      }).then(function (res) {
        var doc = res.rows[0].doc;
        doc._attachments['foo.txt'].content_type.should.equal(
          binAttDoc._attachments['foo.txt'].content_type);
        doc._attachments['foo.txt'].data.should.equal(
          binAttDoc._attachments['foo.txt'].data);
      });
    });

    it('#2771 allDocs() 2, many docs same att', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'foo.txt': {
              data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ=',
              content_type: 'text/plain'
            }
          }
        });
      }
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true, attachments: true});
      }).then(function (res) {
        var attachments = res.rows.map(function (row) {
          var doc = row.doc;
          delete doc._attachments['foo.txt'].revpos;
          should.exist(doc._attachments['foo.txt'].digest);
          delete doc._attachments['foo.txt'].digest;
          return doc._attachments;
        });
        attachments.should.deep.equal([1, 2, 3, 4, 5].map(function () {
          return {
            "foo.txt": {
              "content_type": "text/plain",
              "data": "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
            }
          };
        }));
      });
    });

    it('#2771 allDocs() 3, many docs diff atts', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'foo.png': {
              data: icons[i],
              content_type: 'image/png'
            }
          }
        });
      }
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true, attachments: true});
      }).then(function (res) {
        var attachments = res.rows.map(function (row) {
          var doc = row.doc;
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "foo.png": {
              "content_type": "image/png",
              "data": icon,
              "digest": iconDigests[i]
            }
          };
        }));
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var attachments = res.rows.map(function (row) {
          var doc = row.doc;
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments['foo.png'];
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "content_type": "image/png",
            stub: true,
            "digest": iconDigests[i],
            length: iconLengths[i]
          };
        }));
      });
    });

    it('#2771 allDocs() 4, mix of atts and no atts', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        var doc = {
          _id: i.toString()
        };
        if (i % 2 === 1) {
          doc._attachments = {
            'foo.png': {
              data: icons[i],
              content_type: 'image/png'
            }
          };
        }
        docs.push(doc);
      }
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true, attachments: true});
      }).then(function (res) {
        var attachments = res.rows.map(function (row, i) {
          var doc = row.doc;
          if (i % 2 === 1) {
            delete doc._attachments['foo.png'].revpos;
            return doc._attachments;
          }
          return null;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          if (i % 2 === 0) {
            return null;
          }
          return {
            "foo.png": {
              "content_type": "image/png",
              "data": icon,
              "digest": iconDigests[i]
            }
          };
        }));
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        var attachments = res.rows.map(function (row, i) {
          var doc = row.doc;
          if (i % 2 === 1) {
            delete doc._attachments['foo.png'].revpos;
            return doc._attachments['foo.png'];
          }
          return null;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          if (i % 2 === 0) {
            return null;
          }
          return {
            "content_type": "image/png",
            stub: true,
            "digest": iconDigests[i],
            length: iconLengths[i]
          };
        }));
      });
    });

    it('#2771 allDocs() 5, no atts', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        var doc = {
          _id: i.toString()
        };
        docs.push(doc);
      }
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({include_docs: true, attachments: true});
      }).then(function (res) {
        res.rows.should.have.length(5);
        res.rows.forEach(function (row) {
          should.exist(row.doc);
          should.not.exist(row.doc._attachments);
        });
        return db.allDocs({include_docs: true});
      }).then(function (res) {
        res.rows.should.have.length(5);
        res.rows.forEach(function (row) {
          should.exist(row.doc);
          should.not.exist(row.doc._attachments);
        });
      });
    });

    it('#2771 allDocs() 6, no docs', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        var doc = {
          _id: i.toString()
        };
        docs.push(doc);
      }
      return db.bulkDocs(docs).then(function () {
        return db.allDocs({
          include_docs: true,
          attachments: true,
          keys: []
        });
      }).then(function (res) {
        res.rows.should.have.length(0);
        return db.allDocs({include_docs: true, keys: []});
      }).then(function (res) {
        res.rows.should.have.length(0);
      });
    });

    it('#2771 allDocs() 7, revisions and deletions', function () {
      // blocked on COUCHDB-2519
      if (testUtils.isCouchMaster()) {
        return true;
      }

      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {
        _id: 'doc',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'Zm9vYmFy' // 'foobar'
          }
        }
      };
      var rev;
      return db.put(doc).then(function () {
        return db.allDocs({keys: ['doc'], attachments: true, include_docs: true});
      }).then(function (res) {
        var doc = res.rows[0].doc;
        doc._attachments['foo.txt'].data.should.equal('Zm9vYmFy');
        rev = doc._rev;
        doc._attachments['foo.txt'] = {
          content_type: 'text/plain',
          data: 'dG90bw=='
        }; // 'toto'
        return db.put(doc);
      }).then(function () {
        return db.allDocs({keys: ['doc'], attachments: true, include_docs: true});
      }).then(function (res) {
        var doc = res.rows[0].doc;
        doc._attachments['foo.txt'].data.should.equal('dG90bw==');
        return db.remove(doc);
      }).then(function (res) {
        rev = res.rev;
        return db.allDocs({keys: ['doc'], attachments: true, include_docs: true});
      }).then(function (res) {
        // technically CouchDB sets this to null, but we won't adhere strictly to that
        should.not.exist(res.rows[0].doc);
        delete res.rows[0].doc;
        res.rows.should.deep.equal([
          {
            id: "doc",
            key: "doc",
            value: {
              rev: rev,
              deleted: true
            }
          }
        ]);
      });
    });

    it('#2771 allDocs() 8, empty attachment', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc2).then(function () {
        return db.allDocs({key: binAttDoc2._id, include_docs: true});
      }).then(function (res) {
        var doc = res.rows[0].doc;
        delete doc._attachments["foo.txt"].revpos;

        // because of libicu vs. ascii
        var digest = doc._attachments["foo.txt"].digest;
        var validDigests = [
          'md5-1B2M2Y8AsgTpgAmY7PhCfg==',
          'md5-cCkGbCesb17xjWYNV0GXmg==',
          'md5-3gIs+o2eJiHrXZqziQZqBA=='
        ];
        validDigests.indexOf(digest).should.not.equal(-1,
          'expected ' + digest  + ' to be in: ' +
          JSON.stringify(validDigests));
        delete doc._attachments["foo.txt"].digest;
        delete doc._attachments["foo.txt"].digest;
        doc._attachments.should.deep.equal({
          "foo.txt": {
            "content_type": "text/plain",
            "stub": true,
            length: 0
          }
        });
        return db.allDocs({
          key: binAttDoc2._id,
          include_docs: true,
          attachments: true
        });
      }).then(function (res) {
        var doc = res.rows[0].doc;
        doc._attachments['foo.txt'].content_type.should.equal(
          binAttDoc2._attachments['foo.txt'].content_type);
        doc._attachments['foo.txt'].data.should.equal(
          binAttDoc2._attachments['foo.txt'].data);
      });
    });

    it('No length for non-stubs', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id, {attachments: true});
      }).then(function (doc) {
        should.not.exist(doc._attachments['foo.txt'].stub);
        should.not.exist(doc._attachments['foo.txt'].length);
      });
    });

    it('Test some attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(binAttDoc, function (err, write) {
        should.not.exist(err, 'saved doc with attachment');
        db.get('bin_doc', function (err, doc) {
          should.exist(doc._attachments, 'doc has attachments field');
          should.exist(doc._attachments['foo.txt'], 'doc has attachment');
          doc._attachments['foo.txt'].content_type.should.equal('text/plain');
          db.getAttachment('bin_doc', 'foo.txt', function (err, res) {
            testUtils.readBlob(res, function (data) {
              data.should.equal('This is a base64 encoded text');
              db.put(binAttDoc2, function (err, rev) {
                db.getAttachment('bin_doc2', 'foo.txt',
                  function (err, res, xhr) {
                  testUtils.readBlob(res, function (data) {
                    data.should.equal('', 'Correct data returned');
                    moreTests(rev.rev);
                  });
                });
              });
            });
          });
        });
      });

      function moreTests(rev) {
        var blob = testUtils.makeBlob('This is no base64 encoded text');
        db.putAttachment('bin_doc2', 'foo2.txt', rev, blob, 'text/plain',
                         function (err, info) {
          info.ok.should.equal(true);
          db.getAttachment('bin_doc2', 'foo2.txt', function (err, res, xhr) {
            testUtils.readBlob(res, function (data) {
              should.exist(data);
              db.get('bin_doc2', { attachments: true },
                function (err, res, xhr) {
                should.exist(res._attachments, 'Result has attachments field');
                should.not
                  .exist(res._attachments['foo2.txt'].stub, 'stub is false');
                res._attachments['foo2.txt'].data.should
                  .equal('VGhpcyBpcyBubyBiYXNlNjQgZW5jb2RlZCB0ZXh0');
                res._attachments['foo2.txt'].content_type.should
                  .equal('text/plain');
                res._attachments['foo.txt'].data.should.equal('');
                done();
              });
            });
          });
        });
      }
    });

    it('Test getAttachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(binAttDoc, function (err, res) {
        db.getAttachment('bin_doc', 'foo.txt', function (err, res) {
          if (err) {
            return done(err);
          }
          testUtils.readBlob(res, function (data) {
            data.should.equal('This is a base64 encoded text', 'correct data');
            done();
          });
        });
      });
    });

    it('Test attachments in allDocs/changes', function (done) {
      var db = new PouchDB(dbs.name);
      var docs = [
        { _id: 'doc0' },
        {
          _id: 'doc1',
          _attachments: {
            'att0': {
              data: 'YXR0YWNobWVudDA=',
              content_type: 'text/plain'
            }
          }
        },
        {
          _id: 'doc2',
          _attachments: {
            'att0': {
              data: 'YXR0YWNobWVudDA=',
              content_type: 'text/plain'
            },
            'att1': {
              data: 'YXR0YWNobWVudDE=',
              content_type: 'text/plain'
            }
          }
        },
        {
          _id: 'doc3',
          _attachments: {
            'att0': {
              data: 'YXR0YWNobWVudDA=',
              content_type: 'text/plain'
            }
          }
        }
      ];
      function sort(a, b) {
        return a.id.localeCompare(b.id);
      }
      db.bulkDocs({ docs: docs }, function (err, res) {
        db.allDocs({ include_docs: true }, function (err, res) {
          for (var i = 0; i < docs.length; i++) {
            var attachmentsNb = typeof docs[i]._attachments !== 'undefined' ?
              Object.keys(docs[i]._attachments).length : 0;
            for (var j = 0; j < attachmentsNb; j++) {
              res.rows[i].doc._attachments['att' + j].stub.should
                .equal(true, '(allDocs) doc' + i + ' contains att' + j +
                       ' stub');
            }
          }
          should.not.exist(res.rows[0].doc._attachments,
                           '(allDocs) doc0 contains no attachments');
          db.changes({
            include_docs: true,
            onChange: function (change) {
              var i = +change.id.substr(3);
              if (i === 0) {
                should.not.exist(res.rows[0].doc._attachments,
                                 '(onChange) doc0 contains no attachments');
              } else {
                var attachmentsNb =
                  typeof docs[i]._attachments !== 'undefined' ?
                  Object.keys(docs[i]._attachments).length : 0;
                for (var j = 0; j < attachmentsNb; j++) {
                  res.rows[i].doc._attachments['att' + j].stub.should
                    .equal(true, '(onChange) doc' + i + ' contains att' + j +
                           ' stub');
                }
              }
            },
            complete: function (err, res) {
              var attachmentsNb = 0;
              res.results.sort(sort);
              for (var i = 0; i < 3; i++) {
                attachmentsNb = typeof docs[i]._attachments !== 'undefined' ?
                  Object.keys(docs[i]._attachments).length : 0;
                for (var j = 0; j < attachmentsNb; j++) {
                  res.results[i].doc._attachments['att' + j].stub.should
                    .equal(true, '(complete) doc' + i + ' contains att' + j +
                           ' stub');
                }
              }
              should.not.exist(res.results[0].doc._attachments,
                               '(complete) doc0 contains no attachments');
              done();
            }
          });
        });
      });
    });

    it('Test putAttachment with base64 plaintext', function () {
      var db = new PouchDB(dbs.name);
      return db.putAttachment('doc', 'att', null, 'Zm9v', 'text/plain').then(function () {
        return db.getAttachment('doc', 'att');
      }).then(function (blob) {
        return new PouchDB.utils.Promise(function (resolve) {
          testUtils.base64Blob(blob, function (data) {
            data.should.equal('Zm9v', 'should get the correct base64 back');
            resolve();
          });
        });
      });
    });

    it('Test putAttachment with incorrect base64', function () {
      var db = new PouchDB(dbs.name);
      return db.putAttachment('doc', 'att', null, '\u65e5\u672c\u8a9e', 'text/plain').then(function () {
        throw new Error('shouldnt have gotten here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('Test getAttachment with empty text', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(binAttDoc2, function (err, res) {
        if (err) { return done(err); }
        db.getAttachment('bin_doc2', 'foo.txt', function (err, res) {
          if (err) { return done(err); }
          (typeof res).should.equal('object', 'res is object, ' +
            'not a string');
          testUtils.base64Blob(res, function (data) {
            data.should.equal('', 'correct data');
            db.get(binAttDoc2._id, function (err, doc) {
              var att = doc._attachments['foo.txt'];
              att.stub.should.equal(true);
              // both ascii and libicu
              var validDigests = [
                'md5-1B2M2Y8AsgTpgAmY7PhCfg==',
                'md5-cCkGbCesb17xjWYNV0GXmg==',
                'md5-3gIs+o2eJiHrXZqziQZqBA=='
              ];
              validDigests.indexOf(att.digest).should.be.above(-1);
              att.content_type.should.equal('text/plain');
              att.length.should.equal(0);
              done();
            });
          });
        });
      });
    });

    it('Test getAttachment with normal text', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(binAttDoc, function (err, res) {
        if (err) { return done(err); }
        db.getAttachment('bin_doc', 'foo.txt', function (err, res) {
          if (err) { return done(err); }
          (typeof res).should.equal('object', 'res is object, ' +
            'not a string');
          testUtils.base64Blob(res, function (data) {
            data.should.equal(
              binAttDoc._attachments['foo.txt'].data, 'correct data');
            done();
          });
        });
      });
    });

    it('Test getAttachment with PNG', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(pngAttDoc, function (err, res) {
        if (err) { return done(err); }
        db.getAttachment('png_doc', 'foo.png', function (err, res) {
          if (err) { return done(err); }
          (typeof res).should.equal('object', 'res is object, ' +
            'not a string');
          testUtils.base64Blob(res, function (data) {
            data.should
              .equal(pngAttDoc._attachments['foo.png'].data, 'correct data');
            done();
          });
        });
      });
    });

    it('Test getAttachment with PNG using bulkDocs', function (done) {
      var db = new PouchDB(dbs.name);
      db.bulkDocs([pngAttDoc], function (err, res) {
        if (err) { return done(err); }
        db.getAttachment('png_doc', 'foo.png', function (err, res) {
          if (err) { return done(err); }
          testUtils.base64Blob(res, function (data) {
            data.should
              .equal(pngAttDoc._attachments['foo.png'].data, 'correct data');
            done();
          });
        });
      });
    });

    it('Test getAttachment with PNG using post', function (done) {
      var db = new PouchDB(dbs.name);
      db.post(pngAttDoc, function (err, res) {
        if (err) { return done(err); }
        db.getAttachment('png_doc', 'foo.png', function (err, res) {
          if (err) { return done(err); }
          testUtils.base64Blob(res, function (data) {
            data.should
              .equal(pngAttDoc._attachments['foo.png'].data, 'correct data');
            done();
          });
        });
      });
    });

    it('Test postAttachment with PNG then bulkDocs', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        db.get('foo', function (err, doc) {
          var data = pngAttDoc._attachments['foo.png'].data;
          var blob = testUtils
            .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
              'image/png');
          db.putAttachment('foo', 'foo.png', doc._rev, blob, 'image/png',
              function (err, info) {
            should.not.exist(err, 'attachment inserted');
            db.bulkDocs([{}], function (err) {
              should.not.exist(err, 'doc inserted');
              done();
            });
          });
        });
      });
    });

    it('proper stub behavior', function () {
      var db = new PouchDB(dbs.name);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        return db.putAttachment(doc._id, 'foo.json', doc._rev,
          jsonDoc._attachments['foo.json'].data,
          jsonDoc._attachments['foo.json'].content_type);
      }).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        Object.keys(doc._attachments).forEach(function (filename) {
          var att = doc._attachments[filename];
          should.not.exist(att.data);
          att.stub.should.equal(true);
          should.exist(att.digest);
          should.exist(att.content_type);
        });
        return db.get(binAttDoc._id, {attachments: true});
      }).then(function (doc) {
        Object.keys(doc._attachments).forEach(function (filename) {
          var att = doc._attachments[filename];
          should.exist(att.data);
          should.not.exist(att.stub);
          should.exist(att.digest);
          should.exist(att.content_type);
        });
      });
    });

    it('Testing with invalid docs', function (done) {
      var db = new PouchDB(dbs.name);
      var invalidDoc = {
        '_id': '_invalid',
        foo: 'bar'
      };
      db.bulkDocs({
        docs: [
          invalidDoc,
          binAttDoc
        ]
      }, function (err, info) {
        should.exist(err, 'bad request');
        done();
      });
    });

    it('Test create attachment and doc in one go', function (done) {
      var db = new PouchDB(dbs.name);
      var blob = testUtils.makeBlob('Mytext');
      db.putAttachment('anotherdoc', 'mytext', blob, 'text/plain',
        function (err, res) {
        should.exist(res.ok);
        done();
      });
    });

    it('Test create attachment and doc in one go without callback',
      function (done) {
      var db = new PouchDB(dbs.name);
      var changes = db.changes({
        complete: function (err, result) {
          result.status.should.equal('cancelled');
          done();
        },
        live: true,
        onChange: function (change) {
          if (change.id === 'anotherdoc2') {
            change.id.should.equal('anotherdoc2', 'Doc has been created');
            db.get(change.id, { attachments: true }, function (err, doc) {
              doc._attachments.should.be
                .an('object', 'doc has attachments object');
              should.exist(doc._attachments.mytext,
                           'doc has attachments attachment');
              doc._attachments.mytext.data.should
                .equal('TXl0ZXh0', 'doc has attachments attachment');
              changes.cancel();
            });
          }
        }
      });
      var blob = testUtils.makeBlob('Mytext');
      db.putAttachment('anotherdoc2', 'mytext', blob, 'text/plain');
    });

    it('Test create attachment without callback', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'anotherdoc3' }, function (err, resp) {
        should.not.exist(err, 'doc was saved');
        db.info(function (err, info) {

          var changes = db.changes({
            since: info.update_seq,
            complete: function (err, result) {
              result.status.should.equal('cancelled');
              done();
            },
            live: true,
            include_docs: true,
            onChange: function (change) {
              if (change.id === 'anotherdoc3') {
                db.get(change.id, { attachments: true }, function (err, doc) {
                  doc._attachments.should.be.an('object',
                                              'doc has attachments object');
                  should.exist(doc._attachments.mytext);
                  doc._attachments.mytext.data.should.equal('TXl0ZXh0');
                  changes.cancel();
                });
              }
            }
          });
          var blob = testUtils.makeBlob('Mytext');
          db.putAttachment('anotherdoc3', 'mytext', resp.rev, blob,
            'text/plain');
        });
      });
    });

    it('Test put attachment on a doc without attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', resp.rev, blob, 'text/plain',
                         function (err, res) {
          should.exist(res.ok);
          done();
        });
      });
    });

    it('Test put attachment with unencoded name', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'my/text?@', resp.rev, blob, 'text/plain',
                         function (err, res) {
          should.exist(res.ok);

          db.get('mydoc', { attachments: true }, function (err, res) {
            should.exist(res._attachments['my/text?@']);

            db.getAttachment('mydoc', 'my/text?@', function (err, attachment) {
              testUtils.readBlob(attachment, function (data) {
                data.should.eql('Mytext');

                done();
              });
            });
          });
        });
      });
    });

    it('Testing with invalid rev', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = { _id: 'adoc' };
      db.put(doc, function (err, resp) {
        should.not.exist(err, 'Doc has been saved');
        doc._rev = resp.rev;
        doc.foo = 'bar';
        db.put(doc, function (err, resp) {
          should.not.exist(err, 'Doc has been updated');
          var blob = testUtils.makeBlob('bar');
          db.putAttachment('adoc', 'foo.txt', doc._rev, blob, 'text/plain',
                           function (err) {
            should.exist(err, 'Attachment has not been saved');
            err.name.should.equal('conflict', 'error is a conflict');
            done();
          });
        });
      });
    });

    it('Test put another attachment on a doc with attachments',
      function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, res1) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', res1.rev, blob, 'text/plain',
                         function (err, res2) {
          db.putAttachment('mydoc', 'mytext2', res2.rev, blob, 'text/plain',
                           function (err, res3) {
            should.exist(res3.ok);
            done();
          });
        });
      });
    });

    it('Test get with attachments: true if empty attachments', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: 'foo',
        _attachments: {}
      }, function (err, resp) {
        db.get('foo', { attachments: true }, function (err, res) {
          res._id.should.equal('foo');
          done();
        });
      });
    });

    it('Test delete attachment from a doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({
        _id: 'mydoc',
        _attachments: {
          'mytext1': {
            content_type: 'text/plain',
            data: 'TXl0ZXh0MQ=='
          },
          'mytext2': {
            content_type: 'text/plain',
            data: 'TXl0ZXh0Mg=='
          }
        }
      }, function (err, res) {
        var rev = res.rev;
        db.get('mydoc', { attachments: true }, function (err, res) {
          res._attachments.should.include.keys('mytext1', 'mytext2');
          db.removeAttachment('mydoc', 'mytext1', 0, function (err, res) {
            should.exist(err, 'removal should fail due to broken rev');
            db.removeAttachment('mydoc', 'mytext1', rev, function (err, res) {
              db.get('mydoc', { attachments: true }, function (err, res) {
                res._attachments.should.not.include.keys('mytext1');
                res._attachments.should.include.keys('mytext2');
                db.removeAttachment('mydoc', 'mytext2', res._rev,
                  function (err, res) {
                  should.not.exist(res._attachments);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Test a document with a json string attachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.put(jsonDoc, function (err, results) {
        should.not.exist(err, 'saved doc with attachment');
        db.get(results.id, function (err, doc) {
          should.not.exist(err, 'fetched doc');
          should.exist(doc._attachments, 'doc has attachments field');
          doc._attachments.should.include.keys('foo.json');
          doc._attachments['foo.json'].content_type.should
            .equal('application/json', 'doc has correct content type');
          db.getAttachment(results.id, 'foo.json', function (err, attachment) {
            testUtils.readBlob(attachment, function (data) {
              jsonDoc._attachments['foo.json'].data.should
                .equal('eyJIZWxsbyI6IndvcmxkIn0=', 'correct data');
              done();
            });
          });
        });
      });
    });

    it('Test remove doc with attachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'mydoc' }, function (err, resp) {
        var blob = testUtils.makeBlob('Mytext');
        db.putAttachment('mydoc', 'mytext', resp.rev, blob, 'text/plain',
                         function (err, res) {
          db.get('mydoc', { attachments: false }, function (err, doc) {
            db.remove(doc, function (err, resp) {
              should.exist(res.ok);
              done();
            });
          });
        });
      });
    });

    it('Try to insert a doc with unencoded attachment', function (done) {
      var db = new PouchDB(dbs.name);
      var doc = {
        _id: 'foo',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'this should have been encoded!'
          }
        }
      };
      db.put(doc, function (err, res) {
        should.exist(err);
        err.status.should.equal(500, 'correct error');
        err.name.should.equal('badarg', 'correct error');
        done();
      });
    });

    it('Try to get attachment of unexistent doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.getAttachment('unexistent', 'attachment', function (err, res) {
        should.exist(err, 'Correctly returned error');
        done();
      });
    });

    it('Test synchronous getAttachment', function (done) {
      var db = new PouchDB(dbs.name);
      db.getAttachment('unexistent', 'attachment', function (err, res) {
        should.exist(err, 'Correctly returned error');
        done();
      });
    });

    it('Test synchronous putAttachment with text data', function (done) {
      var db = new PouchDB(dbs.name);
      var blob = testUtils.makeBlob('foobaz', 'text/plain');
      db.putAttachment('a', 'foo2.txt', '', blob, 'text/plain', function (err) {
        should.not.exist(err, 'Correctly wrote attachment');
        db.get('a', { attachments: true }, function (err, doc) {
          should.not.exist(err, 'Correctly got attachment');
          doc._attachments['foo2.txt'].data.should.equal('Zm9vYmF6');
          doc._attachments['foo2.txt'].content_type.should.equal('text/plain');
          done();
        });
      });
    });

    it('Test synchronous putAttachment with no text data', function (done) {
      var db = new PouchDB(dbs.name);
      db.putAttachment('a', 'foo2.txt', '', '', 'text/plain', function (err) {
        should.not.exist(err, 'Correctly wrote attachment');
        db.get('a', { attachments: true }, function (err, doc) {
          should.not.exist(err, 'Correctly got attachment');
          doc._attachments['foo2.txt'].data.should.equal('');
          // firefox 3 appends charset=utf8
          // see http://forums.mozillazine.org/viewtopic.php?p=6318215#p6318215
          doc._attachments['foo2.txt'].content_type.indexOf('text/plain')
            .should.equal(0, 'expected content-type to start with text/plain');
          done();
        });
      });
    });

    it('Test put with partial stubs', function () {
      var db = new PouchDB(dbs.name);
      var doc = {
        _id: 'doc',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'Zm9v'
          },
          'bar.txt': {
            content_type: 'text/plain',
            data: 'Zm9v'
          }
        }
      };
      return db.put(doc).then(function () {
        return db.get(doc._id);
      }).then(function (doc) {
        doc._attachments['baz.txt'] = {
          content_type: 'text/plain',
          data: 'Zm9v'
        };
        // at this point, foo and bar are stubs, but baz is not
        return db.put(doc);
      }).then(function () {
        return db.get(doc._id, {attachments: true});
      }).then(function (doc) {
        doc._rev.should.not.equal('2-x');
        Object.keys(doc._attachments).should.have.length(3);
        Object.keys(doc._attachments).forEach(function (key) {
          var att = doc._attachments[key];
          att.data.should.equal('Zm9v');
          att.content_type.should.equal('text/plain');
        });
      });
    });

    it('Test put with attachments and new_edits=false', function () {
      var db = new PouchDB(dbs.name);
      var doc = {
        _id: 'doc',
        _rev: '2-x',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'Zm9v'
          },
          'bar.txt': {
            content_type: 'text/plain',
            data: 'Zm9v'
          },
          'baz.txt': {
            content_type: 'text/plain',
            data: 'Zm9v'
          }
        },
        _revisions: {
          'start': 2,
          'ids': ['x', 'a']
        }
      };
      return db.bulkDocs([doc], {new_edits: false}).then(function () {
        return db.get(doc._id);
      }).then(function () {
          // at this point, foo and bar are stubs, but baz is not
          return db.bulkDocs([doc], {new_edits: false});
        }).then(function () {
          return db.get(doc._id, {attachments: true});
        }).then(function (doc) {
          doc._rev.should.equal('2-x');
          Object.keys(doc._attachments).should.have.length(3);
          Object.keys(doc._attachments).forEach(function (key) {
            var att = doc._attachments[key];
            att.data.should.equal('Zm9v');
            att.content_type.should.equal('text/plain');
          });
        });
    });

    it('Test stubs', function (done) {
      var db = new PouchDB(dbs.name);
      db.putAttachment('a', 'foo2.txt', '', '', 'text/plain', function (err) {
        db.allDocs({ include_docs: true }, function (err, docs) {
          should.not.exist(docs.rows[0].stub, 'no stub');
          done();
        });
      });
    });

    it('Try to get unexistent attachment of some doc', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        should.not.exist(err, 'doc inserted');
        db.getAttachment('foo', 'unexistentAttachment', function (err, res) {
          should.exist(err, 'Correctly returned error');
          done();
        });
      });
    });

    it('putAttachment and getAttachment with plaintext', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        db.get('foo', function (err, doc) {
          var data = binAttDoc._attachments['foo.txt'].data;
          var blob = testUtils
            .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
              'text/plain');
          db.putAttachment('foo', 'foo.txt', doc._rev, blob, 'text/plain',
                           function (err, info) {
            should.not.exist(err, 'attachment inserted');
            db.getAttachment('foo', 'foo.txt', function (err, blob) {
              should.not.exist(err, 'attachment gotten');
              testUtils.readBlob(blob, function (returnedData) {
                PouchDB.utils.btoa(returnedData).should.equal(data);
                db.get('foo', function (err, doc) {
                  should.not.exist(err, 'err on get');
                  delete doc._attachments["foo.txt"].revpos;

                  // couchdb encodes plaintext strings differently from us
                  // because of libicu vs. ascii. that's okay
                  var digest = doc._attachments["foo.txt"].digest;
                  var validDigests = [
                    "md5-qUUYqS41RhwF0TrCsTAxFg==",
                    "md5-aEI7pOYCRBLTRQvvqYrrJQ==",
                    "md5-jeLnIuUvK7d+6gya044lVA=="
                  ];
                  validDigests.indexOf(digest).should.not.equal(-1,
                    'expected ' + digest  + ' to be in: ' +
                      JSON.stringify(validDigests));
                  delete doc._attachments["foo.txt"].digest;
                  doc._attachments.should.deep.equal({
                    "foo.txt": {
                      "content_type": "text/plain",
                      "stub": true,
                      length: 29
                    }
                  });
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('putAttachment and getAttachment with png data', function (done) {
      var db = new PouchDB(dbs.name);
      db.put({ _id: 'foo' }, function (err, res) {
        db.get('foo', function (err, doc) {
          var data = pngAttDoc._attachments['foo.png'].data;
          var blob = testUtils
            .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
                                              'image/png');
          db.putAttachment('foo', 'foo.png', doc._rev, blob, 'image/png',
                           function (err, info) {
            should.not.exist(err, 'attachment inserted');
            db.getAttachment('foo', 'foo.png', function (err, blob) {
              should.not.exist(err, 'attachment gotten');
              testUtils.readBlob(blob, function (returnedData) {
                PouchDB.utils.btoa(returnedData).should.equal(data);
                db.get('foo', function (err, doc) {
                  should.not.exist(err, 'err on get');
                  delete doc._attachments["foo.png"].revpos;
                  doc._attachments.should.deep.equal({
                    "foo.png": {
                      "content_type": "image/png",
                      "digest": "md5-c6eA+rofKUsstTNQBKUc8A==",
                      "stub": true,
                      length: 229
                    }
                  });
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('#2818 - save same attachment in different revs', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});

      return db.put({_id: 'foo'}).then(function (res) {
        return db.putAttachment('foo', 'att', res.rev, 'Zm9v', 'text/plain');
      }).then(function () {
        return db.get('foo', {attachments: true});
      }).then(function (doc) {
        doc._attachments['att'].content_type.should.match(/^text\/plain/);
        should.exist(doc._attachments['att'].data);
        return db.get('foo');
      }).then(function (doc) {
        return db.put(doc);
      }).then(function () {
        return db.compact();
      }).then(function () {
        return db.get('foo', {attachments: true});
      }).then(function (doc) {
        doc._attachments['att'].content_type.should.match(/^text\/plain/);
        doc._attachments['att'].data.length.should.be.above(0, 'attachment exists');
      });
    });

    it('#2818 - save same attachment many times in parallel', function () {
      var db = new PouchDB(dbs.name);
      var docs = [];

      for (var i  = 0; i < 50; i++) {
        docs.push({
          _id: 'doc' + i,
          _attachments: {
            'foo.txt': {
              content_type: 'text/plain',
              data: 'Zm9vYmFy' // 'foobar'
            }
          }
        });
      }
      return db.bulkDocs(docs);
    });

    it('#2818 - revisions keep attachments (no compaction)', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {
        _id: 'doc',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'Zm9vYmFy' // 'foobar'
          }
        }
      };
      var rev;
      return db.put(doc).then(function () {
        return db.get('doc');
      }).then(function (doc) {
        rev = doc._rev;
        //delete doc._attachments['foo.txt'];
        doc._attachments['foo.txt'] = {
          content_type: 'text/plain',
          data: 'dG90bw=='
        }; // 'toto'
        return db.put(doc);
      }).then(function () {
        return db.get('doc', {attachments: true});
      }).then(function (doc) {
        doc._attachments['foo.txt'].data.should.equal('dG90bw==');
        return db.get('doc', {rev: rev, attachments: true});
      }).then(function (doc) {
        doc._attachments['foo.txt'].data.should.equal('Zm9vYmFy');
      });
    });

    it('#2818 - doesn\'t throw 409 if same filename', function () {
      var db = new PouchDB(dbs.name, {auto_compaction: false});
      var doc = {
        _id: 'doc',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'Zm9vYmFy' // 'foobar'
          }
        }
      };
      var rev;
      return db.put(doc).then(function (res) {
        rev = doc._rev = res.rev;
        doc._attachments['foo.txt'].data = 'dG90bw=='; // 'toto'
        return db.put(doc);
      });
    });

    if (typeof process === 'undefined' || process.browser) {
      it('test stored URL content type of png data', function (done) {
        var db = new PouchDB(dbs.name);
        db.put({ _id: 'foo' }, function (err, res) {
          db.get('foo', function (err, doc) {
            var data = pngAttDoc._attachments['foo.png'].data;
            var blob = testUtils
              .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
                'image/png');
            if (typeof URL === 'undefined') {
              // phantomjs doesn't have this, give up on this test
              return done();
            }
            var checkedOnce = false;
            function checkBlobType(blob, cb) {
              var url = URL.createObjectURL(blob);
              PouchDB.utils.ajax({
                url: url,
                cache: true,
                binary: true
              }, function (err, res) {
                if (err && err.status === 500) {
                  // firefox won't let us use ajax to get the blob.
                  // too bad, but firefox wasn't the problem anyway
                  return done();
                }
                should.not.exist(err, 'ajax gotten');
                if (!checkedOnce) {
                  checkedOnce = true;
                  if (res.type !== 'image/png') {
                    // in Safari/iOS 7, blob URLs are missing
                    // the content type even without storing them.
                    // so just give up.
                    return done();
                  }
                } else {
                  res.type.should.equal('image/png');
                }
                cb();
              });
            }
            checkBlobType(blob, function () {
              db.putAttachment('foo', 'foo.png', doc._rev, blob, 'image/png',
                function (err, info) {
                should.not.exist(err, 'attachment inserted');
                db.getAttachment('foo', 'foo.png', function (err, blob) {
                  should.not.exist(err, 'attachment gotten');
                  checkBlobType(blob, done);
                });
              });
            });
          });
        });
      });
    }

    it('#3008 test correct encoding/decoding of \\u0000 etc.', function () {

      var base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAhgAAAJLCAYAAAClnu9J' +
        'AAAgAElEQVR4Xuy9B7ylZXUu/p62T5nOMAPM0BVJICQi' +
        'ogjEJN5ohEgQ';

      var db = new PouchDB(dbs.name);
      return db.putAttachment('foo', 'foo.bin', base64, 'image/png').then(function () {
        return db.getAttachment('foo', 'foo.bin');
      }).then(function (blob) {
        return new PouchDB.utils.Promise(function (resolve) {
          testUtils.readBlob(blob, resolve);
        });
      }).then(function (bin) {
        PouchDB.utils.btoa(bin).should.equal(base64);
      });
    });


    var isSafari = (typeof process === 'undefined' || process.browser) &&
      /Safari/.test(window.navigator.userAgent) &&
      !/Chrome/.test(window.navigator.userAgent);
    if (!isSafari) {
      // skip in safari/ios because of size limit popup
      it('putAttachment and getAttachment with big png data', function (done) {

        function getData(cb) {
          if (typeof process !== 'undefined' && !process.browser) {
            var bigimage = require('./deps/bigimage.js');
            cb(null, bigimage);
          } else { // browser
            var script = document.createElement('script');
            script.src = 'deps/bigimage.js';
            document.body.appendChild(script);
            var timeout = setInterval(function () {
              if (!!window.bigimage) {
                clearInterval(timeout);
                cb(null, window.bigimage);
              }
            }, 500);
          }
        }

        var db = new PouchDB(dbs.name);
        db.put({ _id: 'foo' }, function (err, res) {
          db.get('foo', function (err, doc) {

            getData(function (err, data) {
              var blob = testUtils
                .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
                  'image/png');
              db.putAttachment('foo', 'foo.png', doc._rev, blob, 'image/png',
                  function (err, info) {
                should.not.exist(err, 'attachment inserted');
                db.getAttachment('foo', 'foo.png', function (err, blob) {
                  should.not.exist(err, 'attachment gotten');
                  testUtils.readBlob(blob, function (returnedData) {
                    PouchDB.utils.btoa(returnedData).should.equal(data);
                    db.get('foo', function (err, doc) {
                      should.not.exist(err, 'err on get');
                      delete doc._attachments["foo.png"].revpos;
                      doc._attachments.should.deep.equal({
                        "foo.png": {
                          "content_type": "image/png",
                          "digest": "md5-kqr2YcdElgDs3RkMn1Ygbw==",
                          "stub": true,
                          length: 678010
                        }
                      });
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }
  });
});

repl_adapters.forEach(function (adapters) {
  describe('test.attachments.js- ' + adapters[0] + ':' + adapters[1],
    function () {

    var dbs = {};

    beforeEach(function (done) {
      dbs.name = testUtils.adapterUrl(adapters[0], 'testdb');
      dbs.remote = testUtils.adapterUrl(adapters[1], 'test_attach_remote');
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    afterEach(function (done) {
      testUtils.cleanup([dbs.name, dbs.remote], done);
    });

    it('Attachments replicate', function (done) {
      var binAttDoc = {
        _id: 'bin_doc',
        _attachments: {
          'foo.txt': {
            content_type: 'text/plain',
            data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
          }
        }
      };
      var docs1 = [
        binAttDoc,
        {_id: '0', integer: 0},
        {_id: '1', integer: 1},
        {_id: '2', integer: 2},
        {_id: '3', integer: 3}
      ];

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      remote.bulkDocs({ docs: docs1 }, function (err, info) {
        db.replicate.from(remote, function () {
          db.get('bin_doc', { attachments: true }, function (err, doc) {
            binAttDoc._attachments['foo.txt'].data.should
              .equal(doc._attachments['foo.txt'].data);
            done();
          });
        });
      });
    });

    it('Many many attachments replicate', function () {
      var doc = {_id: 'foo'};

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var rev;

      var data = PouchDB.utils.btoa('foobar');
      var blob = testUtils
        .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
          'text/plain');

      doc._attachments = {};
      var expectedKeys = [];
      for (var i = 0; i < 50; i++) {
        doc._attachments[i + '.txt'] = {
          content_type: 'text/plain',
          data: blob
        };
        expectedKeys.push(i + '.txt');
      }
      return db.put(doc).then(function (info) {
        rev = info.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return remote.get('foo', {attachments: true});
      }).then(function (doc) {
        var keys = Object.keys(doc._attachments);
        keys.sort();
        keys.should.deep.equal(expectedKeys.sort());
        doc._attachments[keys[0]].data.should.equal(data);
      });
    });

    it('Many many png attachments replicate', function () {
      var doc = {_id: 'foo'};

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var rev;

      var data = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAMFBMVEX+9+' +
        'j+9OD+7tL95rr93qT80YD7x2L6vkn6syz5qRT4ogT4nwD4ngD4nQD4nQD4' +
        'nQDT2nT/AAAAcElEQVQY002OUQLEQARDw1D14f7X3TCdbfPnhQTqI5UqvG' +
        'OWIz8gAIXFH9zmC63XRyTsOsCWk2A9Ga7wCXlA9m2S6G4JlVwQkpw/Ymxr' +
        'UgNoMoyxBwSMH/WnAzy5cnfLFu+dK2l5gMvuPGLGJd1/9AOiBQiEgkzOpg' +
        'AAAABJRU5ErkJggg==';
      var blob = testUtils
        .makeBlob(PouchDB.utils.fixBinary(PouchDB.utils.atob(data)),
          'image/png');

      doc._attachments = {};
      var expectedKeys = [];
      for (var i = 0; i < 50; i++) {
        doc._attachments[i + '.txt'] = {
          content_type: 'image/png',
          data: blob
        };
        expectedKeys.push(i + '.txt');
      }
      return db.put(doc).then(function (info) {
        rev = info.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return remote.get('foo', {attachments: true});
      }).then(function (doc) {
        var keys = Object.keys(doc._attachments);
        keys.sort();
        keys.should.deep.equal(expectedKeys.sort());
        doc._attachments[keys[0]].data.should.equal(data);
      });
    });

    it('Multiple attachments replicate', function () {
      var doc = {_id: 'foo'};

      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);

      var data = 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ=';
      var rev;
      return db.put(doc).then(function (info) {
        rev = info.rev;
        return db.replicate.to(remote);
      }).then(function () {
        return db.putAttachment(doc._id, 'foo1.txt', rev, data, 'text/plain');
      }).then(function (info) {
        rev = info.rev;
        return db.putAttachment(doc._id, 'foo2.txt', rev, data, 'text/plain');
      }).then(function (info) {
        rev = info.rev;
        return db.putAttachment(doc._id, 'foo3.txt', rev, data, 'text/plain');
      }).then(function () {
        return db.replicate.to(remote);
      }).then(function () {
        return remote.get('foo', {attachments: true});
      }).then(function (doc) {
        var keys = Object.keys(doc._attachments);
        keys.sort();
        keys.should.deep.equal(['foo1.txt', 'foo2.txt', 'foo3.txt']);
      });
    });

    it('Multiple attachments replicate, different docs (#2698)', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'foo.txt': {
              data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ=',
              content_type: 'text/plain'
            }
          }
        });
      }
      return remote.bulkDocs(docs).then(function (info) {
        return remote.replicate.to(db);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        return PouchDB.utils.Promise.all(res.rows.map(function (row) {
          return db.get(row.id, {attachments: true});
        }));
      }).then(function (docs) {
        var attachments = docs.map(function (doc) {
          delete doc._attachments['foo.txt'].revpos;
          delete doc._attachments['foo.txt'].digest;
          return doc._attachments;
        });
        attachments.should.deep.equal([1, 2, 3, 4, 5].map(function () {
          return {
            "foo.txt": {
              "content_type": "text/plain",
              "data": "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
            }
          };
        }));
      });
    });

    it('Multiple attachments replicate, different docs png (#2698)', function () {
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      var docs = [];
      for (var i = 0; i < 5; i++) {
        docs.push({
          _id: i.toString(),
          _attachments: {
            'foo.png': {
              data: icons[i],
              content_type: 'image/png'
            }
          }
        });
      }
      return remote.bulkDocs(docs).then(function (info) {
        return remote.replicate.to(db);
      }).then(function () {
        return db.allDocs();
      }).then(function (res) {
        return PouchDB.utils.Promise.all(res.rows.map(function (row) {
          return db.get(row.id, {attachments: true});
        }));
      }).then(function (docs) {
        var attachments = docs.map(function (doc) {
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments;
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "foo.png": {
              "content_type": "image/png",
              "data": icon,
              "digest": iconDigests[i]
            }
          };
        }));

        return PouchDB.utils.Promise.all(docs.map(function (doc) {
          return db.get(doc._id);
        }));
      }).then(function (docs) {
        var attachments = docs.map(function (doc) {
          delete doc._attachments['foo.png'].revpos;
          return doc._attachments['foo.png'];
        });
        attachments.should.deep.equal(icons.map(function (icon, i) {
          return {
            "content_type": "image/png",
            stub: true,
            "digest": iconDigests[i],
            length: iconLengths[i]
          };
        }));
      });
    });

    it('replication with changing attachments', function () {
      var attachment = {
        content_type: 'text/plain',
        data: 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ='
      };
      var attachment2 = {
        content_type: 'text/plain',
        data: ''
      };
      var binAttDoc = {
        _id: 'bin_doc',
        _attachments: {
          'foo.txt': attachment
        }
      };
      var db = new PouchDB(dbs.name);
      var remote = new PouchDB(dbs.remote);
      return db.put(binAttDoc).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        should.exist(doc);
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        doc._attachments['bar.txt'] = attachment2;
        return db.put(doc);
      }).then(function () {
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        should.exist(doc);
        return db.get(binAttDoc._id, {attachments: true});
      }).then(function (doc) {
        should.not.exist(doc._attachments['foo.txt'].stub);
        should.not.exist(doc._attachments['bar.txt'].stub);
        return db.replicate.to(remote);
      }).then(function () {
        return remote.get(binAttDoc._id, {attachments: true});
      }).then(function (doc) {
        should.not.exist(doc._attachments['foo.txt'].stub);
        doc._attachments['baz.txt'] = doc._attachments['foo.txt'];
        return remote.put(doc);
      }).then(function () {
        return remote.replicate.to(db);
      }).then(function () {
        return db.get(binAttDoc._id, {attachments: true});
      }).then(function (doc) {
        should.not.exist(doc._attachments['foo.txt'].stub);
        should.not.exist(doc._attachments['bar.txt'].stub);
        should.not.exist(doc._attachments['baz.txt'].stub);
        return db.get(binAttDoc._id);
      }).then(function (doc) {
        should.exist(doc);
      });
    });
  });
});
