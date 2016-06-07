'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;
var Promise = require('pouchdb-promise');

module.exports = function tests(dbName, dbType, viewType, PouchDB) {

  var suiteName = 'test.persisted.js';

  describe(suiteName, function () {

    function setTimeoutPromise(time) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(true); }, time);
      });
    }

    function createView(db, viewObj) {
      var storableViewObj = {
        map : viewObj.map.toString()
      };
      if (viewObj.reduce) {
        storableViewObj.reduce = viewObj.reduce.toString();
      }
      return new Promise(function (resolve, reject) {
        db.put({
          _id: '_design/theViewDoc',
          views: {
            'theView' : storableViewObj
          }
        }, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve('theViewDoc/theView');
          }
        });
      });
    }

    beforeEach(function () {
      return new PouchDB(dbName).destroy();
    });
    afterEach(function () {
      return new PouchDB(dbName).destroy();
    });

    it('Test destroyed event on auxiliary db', function () {
      var db = new PouchDB(dbName);
      var rev;
      return db.put({
        _id: '_design/name',
        views: {
          name: {
            map: function (doc) {
              emit(doc.name);
            }.toString()
          }
        }
      }).then(function (res) {
        rev = res.rev;
        return db.bulkDocs([
          {_id: 'foo', name: 'foo', title: 'yo'},
          {_id: 'baz', name: 'bar', title: 'hey'},
          {_id: 'bar', name: 'baz', title: 'wuzzup'}
        ]);
      }).then(function () {
        return db.query('name');
      }).then(function () {
        return db.remove('_design/name', rev);
      }).then(function () {
        return db.viewCleanup();
      }).then(function () {
        return db.put({
          _id: '_design/title',
          views: {
            title: {
              map: function (doc) {
                emit(doc.title);
              }.toString()
            }
          }
        });
      }).then(function (res) {
        rev = res.rev;
      }).then(function () {
        return db.query('title');
      }).then(function () {
        return db.remove('_design/title', rev);
      }).then(function () {
        return db.viewCleanup();
      }).then(function () {
        var views = ['name', 'title'];
        return Promise.all(views.map(function (view) {
          return db.query(view).then(function () {
            throw new Error('expected an error');
          }, function (err) {
            should.exist(err);
          });
        }));
      }).then(function () {
        return db.put({
          _id: '_design/name',
          views: {
            name: {
              map: function (doc) {
                emit(doc.name);
              }.toString()
            }
          }
        }).then(function (res) {
          rev = res.rev;
          return db.query('name');
        }).then(function (res) {
          res.rows.map(function (row) {
            return [row.id, row.key];
          }).should.deep.equal([
              ['baz', 'bar'],
              ['bar', 'baz'],
              ['foo', 'foo']
            ]);
        });
      });
    });

    it('Returns ok for viewCleanup on empty db', function () {
      return new PouchDB(dbName).then(function (db) {
        return db.viewCleanup().then(function (res) {
          res.ok.should.equal(true);
        });
      });
    });

    it('Returns ok for viewCleanup on empty db, callback style', function () {
      return new PouchDB(dbName).then(function (db) {
        return new Promise(function (resolve, reject) {
          db.viewCleanup(function (err, res) {
            if (err) {
              return reject(err);
            }
            resolve(res);
          });
        }).then(function (res) {
            res.ok.should.equal(true);
          });
      });
    });

    it('Returns ok for viewCleanup after modifying view', function () {
      return new PouchDB(dbName).then(function (db) {
        var ddoc = {
          _id: '_design/myview',
          views: {
            myview: {
              map: function (doc) {
                emit(doc.firstName);
              }.toString()
            }
          }
        };
        var doc = {
          _id: 'foo',
          firstName: 'Foobar',
          lastName: 'Bazman'
        };
        return db.bulkDocs({docs: [ddoc, doc]}).then(function (info) {
          ddoc._rev = info[0].rev;
          return db.query('myview');
        }).then(function (res) {
          res.rows.should.deep.equal([
            {id: 'foo', key: 'Foobar', value: null}
          ]);
          ddoc.views.myview.map = function (doc) {
            emit(doc.lastName);
          }.toString();
          return db.put(ddoc);
        }).then(function () {
          return db.query('myview');
        }).then(function (res) {
          res.rows.should.deep.equal([
            {id: 'foo', key: 'Bazman', value: null}
          ]);
          return db.viewCleanup();
        });
      });
    });

    it('Return ok for viewCleanup after modding view, old format', function () {
      return new PouchDB(dbName).then(function (db) {
        var ddoc = {
          _id: '_design/myddoc',
          views: {
            myview: {
              map: function (doc) {
                emit(doc.firstName);
              }.toString()
            }
          }
        };
        var doc = {
          _id: 'foo',
          firstName: 'Foobar',
          lastName: 'Bazman'
        };
        return db.bulkDocs({docs: [ddoc, doc]}).then(function (info) {
          ddoc._rev = info[0].rev;
          return db.query('myddoc/myview');
        }).then(function (res) {
          res.rows.should.deep.equal([
            {id: 'foo', key: 'Foobar', value: null}
          ]);
          ddoc.views.myview.map = function (doc) {
            emit(doc.lastName);
          }.toString();
          return db.put(ddoc);
        }).then(function () {
          return db.query('myddoc/myview');
        }).then(function (res) {
          res.rows.should.deep.equal([
            {id: 'foo', key: 'Bazman', value: null}
          ]);
          return db.viewCleanup();
        });
      });
    });

    it("Query non existing view returns error", function () {
      return new PouchDB(dbName).then(function (db) {
        var doc = {
          _id: '_design/barbar',
          views: {
            scores: {
              map: 'function(doc) { if (doc.score) { emit(null, doc.score); } }'
            }
          }
        };
        return db.post(doc).then(function () {
          return db.query('barbar/dontExist', {key: 'bar'});
        });
      }).should.be.rejected;
    });

    it('many simultaneous persisted views', function () {
      this.timeout(120000);
      var db = new PouchDB(dbName);

      var views = [];
      var doc = {_id: 'foo'};
      for (var i = 0; i < 20; i++) {
        views.push('foo_' + i);
        doc['foo_' + i] = 'bar_' + i;
      }

      return db.put(doc).then(function () {
        return Promise.all(views.map(function (_, i) {
          var fun = "function (doc) { emit(doc.foo_" + i + ");}";

          var ddocId = 'theViewDoc_' + i;
          var ddoc = {
            _id: '_design/' + ddocId,
            views: {
              theView : {map: fun}
            }
          };

          return db.put(ddoc).then(function (res) {
            ddoc._rev = res.rev;
            return db.query(ddocId + '/theView');
          }).then(function (res) {
            res.rows.should.have.length(1);
            res.rows[0].key.should.equal('bar_' + i);
            res.rows[0].id.should.equal('foo');
            return db.remove(ddoc);
          }).then(function () {
            return db.viewCleanup();
          }).then(function () {
            return db.query(ddocId + '/theView').then(function () {
              throw new Error('view should have been deleted');
            }, function (err) {
              should.exist(err);
            });
          });
        }));
      });
    });

    it('should error with a callback', function (done) {
      new PouchDB(dbName, function (err, db) {
        db.query('fake/thing', function (err) {
          should.exist(err);
          done();
        });
      });
    });

    it('should query correctly when stale', function () {
      return new PouchDB(dbName).then(function (db) {
        return createView(db, {
          map : function (doc) {
            emit(doc.name);
          }
        }).then(function (queryFun) {
          return db.bulkDocs({docs : [
            {name : 'bar', _id : '1'},
            {name : 'foo', _id : '2'}
          ]}).then(function () {
            return db.query(queryFun, {stale : 'ok'});
          }).then(function (res) {
            res.total_rows.should.be.within(0, 2);
            res.offset.should.equal(0);
            res.rows.length.should.be.within(0, 2);
            return db.query(queryFun, {stale : 'update_after'});
          }).then(function (res) {
            res.total_rows.should.be.within(0, 2);
            res.rows.length.should.be.within(0, 2);
            return setTimeoutPromise(5);
          }).then(function () {
            return db.query(queryFun, {stale : 'ok'});
          }).then(function (res) {
            res.total_rows.should.equal(2);
            res.rows.length.should.equal(2);
            return db.get('2');
          }).then(function (doc2) {
            return db.remove(doc2);
          }).then(function () {
            return db.query(queryFun, {stale : 'ok', include_docs : true});
          }).then(function (res) {
            res.total_rows.should.be.within(1, 2);
            res.rows.length.should.be.within(1, 2);
            if (res.rows.length === 2) {
              res.rows[1].key.should.equal('foo');
              should.not.exist(res.rows[1].doc,
                'should not throw if doc removed');
            }
            return db.query(queryFun);
          }).then(function (res) {
            res.total_rows.should.equal(1, 'equals1-1');
            res.rows.length.should.equal(1, 'equals1-2');
            return db.get('1');
          }).then(function (doc1) {
            doc1.name = 'baz';
            return db.post(doc1);
          }).then(function () {
            return db.query(queryFun, {stale : 'update_after'});
          }).then(function (res) {
            res.rows.length.should.equal(1);
            ['baz', 'bar'].indexOf(res.rows[0].key).should.be.above(-1,
              'key might be stale, thats ok');
            return setTimeoutPromise(1000);
          }).then(function () {
            return db.query(queryFun, {stale : 'ok'});
          }).then(function (res) {
            res.rows.length.should.equal(1);
            res.rows[0].key.should.equal('baz');
          });
        });
      });
    });

    it('should query correctly with stale update_after', function () {
      var pouch = new PouchDB(dbName);

      return createView(pouch, {map: function (doc) {
        emit(doc.foo);
      }}).then(function (queryFun) {
        var docs = [];

        for (var i = 0; i < 10; i++) {
          docs.push({foo: 'bar'});
        }

        return pouch.bulkDocs(docs).then(function () {
          return pouch.query(queryFun, {stale: 'update_after'});
        }).then(function (res) {
          res.rows.should.have.length(0, 'query() returned immediately');
          return setTimeoutPromise(1000);
        }).then(function () {
          return pouch.query(queryFun, {stale: 'ok'});
        }).then(function (res) {
          res.rows.should.have.length(10, 'index was built in background');
        });
      });
    });

    it('should delete duplicate indexes', function () {
      var docs = [];
      for (var i = 0; i < 10; i++) {
        docs.push(
          {
            _id : '_design/view' + i,
            views : {
              view : {
                map : "function(doc){emit('foo');}"
              }
            }
          }
        );
      }
      return new PouchDB(dbName).then(function (db) {
        return db.bulkDocs({docs : docs}).then(function (responses) {
          var tasks = [];
          for (var i = 0; i < docs.length; i++) {
            /* jshint loopfunc:true */
            docs[i]._rev = responses[i].rev;
            tasks.push(db.query('view' + i + '/view'));
          }
          return Promise.all(tasks);
        }).then(function () {
          docs.forEach(function (doc) {
            doc._deleted = true;
          });
          return db.bulkDocs({docs : docs});
        }).then(function () {
          return db.viewCleanup();
        });
      });
    });

    it('should handle user errors in design doc names', function () {
      return new PouchDB(dbName).then(function (db) {
        return db.put({
          _id : '_design/theViewDoc'
        }).then(function () {
          return db.query('foo/bar');
        }).then(function (res) {
          should.not.exist(res);
        }).catch(function (err) {
          err.status.should.equal(404);
          return db.put(
            {_id : '_design/void', views : {1 : null}}
          ).then(function () {
              return db.query('void/1');
            }).then(function (res) {
              should.not.exist(res);
            }).catch(function (err) {
              err.status.should.be.a('number');
              // this might throw due to erroneous ddoc, but that's ok
              return db.viewCleanup().catch(function (err) {
                err.status.should.equal(500);
              });
            });
        });
      });
    });

    it('should allow the user to create many design docs', function () {
      function getKey(row) {
        return row.key;
      }
      return new PouchDB(dbName).then(function (db) {
        return db.put({
          _id : '_design/foo',
          views : {
            byId : { map : function (doc) { emit(doc._id); }.toString()},
            byField : { map : function (doc) { emit(doc.field); }.toString()}
          }
        }).then(function () {
          return db.put({_id : 'myDoc', field : 'myField'});
        }).then(function () {
          return db.query('foo/byId');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myDoc']);
          return db.put({
            _id : '_design/bar',
            views : {
              byId : {map : function (doc) { emit(doc._id); }.toString()}
            }
          });
        }).then(function () {
          return db.query('bar/byId');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myDoc']);
        }).then(function () {
          return db.viewCleanup();
        }).then(function () {
          return db.query('foo/byId');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myDoc']);
          return db.query('foo/byField');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myField']);
          return db.query('bar/byId');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myDoc']);
          return db.get('_design/bar');
        }).then(function (barDoc) {
          return db.remove(barDoc);
        }).then(function () {
          return db.get('_design/foo');
        }).then(function (fooDoc) {
          delete fooDoc.views.byField;
          return db.put(fooDoc);
        }).then(function () {
          return db.query('foo/byId');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myDoc']);
          return db.viewCleanup();
        }).then(function () {
          return db.query('foo/byId');
        }).then(function (res) {
          res.rows.map(getKey).should.deep.equal(['myDoc']);
          return db.query('foo/byField').then(function (res) {
            should.not.exist(res);
          }).catch(function (err) {
            err.status.should.equal(404);
            return db.query('bar/byId').then(function (res) {
              should.not.exist(res);
            }).catch(function (err) {
              err.status.should.equal(404);
              return db.get('_design/foo').then(function (fooDoc) {
                return db.remove(fooDoc).then(function () {
                  return db.viewCleanup();
                });
              });
            });
          });
        });
      });
    });

    it('should allow view names without slashes', function () {
      var ddocRev;
      return new PouchDB(dbName).then(function (db) {
        return db.put({
          _id : '_design/foo',
          views : {
            foo : { map : function (doc) { emit(doc._id); }.toString()}
          }
        }).then(function (info) {
          ddocRev = info.rev;
          return db.bulkDocs({docs : [{_id : 'baz'}, {_id : 'bar'}]});
        }).then(function () {
          return db.query('foo');
        }).then(function (res) {
          res.rows[0].key.should.equal('bar');
          res.rows[1].key.should.equal('baz');
          return db.remove({_id : '_design/foo', _rev : ddocRev});
        });
      });
    });
    it('test 304s in Safari (issue 69)', function () {
      return new PouchDB(dbName).then(function (db) {
        return createView(db, {
          map : function (doc) {
            emit(doc.name);
          }
        }).then(function (queryFun) {
          return db.bulkDocs({docs : [
            {name : 'foo'}
          ]}).then(function () {
            return db.query(queryFun, {keys : ['foo']});
          }).then(function (res) {
            res.rows.should.have.length(1);
            return db.query(queryFun, {keys : ['foo']});
          }).then(function (res) {
            res.rows.should.have.length(1);
            return db.query(queryFun, {keys : ['foo']});
          }).then(function (res) {
            res.rows.should.have.length(1);
          });
        });
      });
    });

    var isNode = typeof window === 'undefined';
    if (dbType === 'local' && isNode) {
      it('#239 test memdown db', function () {
        var destroyedDBs = [];
        PouchDB.on('destroyed', function (db) {
          destroyedDBs.push(db);
        });

        // make sure prefixed DBs are tied to regular DBs
        var db = new PouchDB(dbName, {db: require('memdown')});
        return testUtils.fin(createView(db, {
          map: function (doc) {
            emit(doc.name);
          }
        }).then(function (queryFun) {
          return db.post({name: 'foo'}).then(function () {
            return db.query(queryFun);
          }).then(function (res) {
            res.rows.should.have.length(1);
            res.rows[0].key.should.equal('foo');
            var ddocId = '_design/' + queryFun.split('/')[0];
            return db.get(ddocId);
          }).then(function (ddoc) {
            return db.remove(ddoc);
          }).then(function () {
            return db.viewCleanup();
          });
        }), function () {
          return db.destroy().then(function () {
            var chain = Promise.resolve();
            // for each of the supposedly destroyed DBs,
            // check that there isn't a normal DB hanging around
            destroyedDBs.forEach(function (dbName) {
              chain = chain.then(function () {
                var db = new PouchDB(dbName);
                var promise = db.info().then(function (info) {
                  info.update_seq.should.equal(0);
                });
                return testUtils.fin(promise, function () {
                  return db.destroy();
                });
              });
            });
            return chain;
          }).then(function () {
            PouchDB.removeAllListeners('destroyed');
          });
        });
      });

      it('#239 test prefixed db', function () {
        var destroyedDBs = [];
        PouchDB.on('destroyed', function (db) {
          destroyedDBs.push(db);
        });

        // make sure prefixed DBs are tied to regular DBs
        require('mkdirp').sync('./myprefix_./tmp/'); // TODO: bit hacky
        var db = new PouchDB(dbName, {prefix: './myprefix_'});
        return testUtils.fin(createView(db, {
          map: function (doc) {
            emit(doc.name);
          }
        }).then(function (queryFun) {
          return db.post({name: 'foo'}).then(function () {
            return db.query(queryFun);
          }).then(function (res) {
            res.rows.should.have.length(1);
            res.rows[0].key.should.equal('foo');
            var ddocId = '_design/' + queryFun.split('/')[0];
            return db.get(ddocId);
          }).then(function (ddoc) {
            return db.remove(ddoc);
          }).then(function () {
            return db.viewCleanup();
          });
        }), function () {
          return db.destroy().then(function () {
            var chain = Promise.resolve();
            // for each of the supposedly destroyed DBs,
            // check that there isn't a normal DB hanging around
            destroyedDBs.forEach(function (dbName) {
              chain = chain.then(function () {
                var db = new PouchDB(dbName);
                var promise = db.info().then(function (info) {
                  info.update_seq.should.equal(0);
                });
                return testUtils.fin(promise, function () {
                  return db.destroy();
                });
              });
            });
            return chain;
          }).then(function () {
            PouchDB.removeAllListeners('destroyed');
          });
        });
      });
    }

  });
};
