'use strict';
if (!process.env.LEVEL_ADAPTER &&
    !process.env.LEVEL_PREFIX && !process.env.AUTO_COMPACTION) {
  // these tests don't make sense for anything other than default leveldown
  var path = require('path');
  var mkdirp = require('mkdirp');
  var rimraf = require('rimraf');

  describe('defaults', function () {

    beforeEach(function () {
      return new PouchDB('mydb').destroy().then(function () {
        return new PouchDB('mydb', {db: require('memdown')}).destroy();
      });
    });

    afterEach(function (done) {
      rimraf.sync('./tmp/_pouch_.');
      rimraf.sync('./tmp/path');
      done();
    });

    it('should allow prefixes', function () {
      var prefix = './tmp/path/to/db/1/';
      var dir = path.join(prefix, '/tmp/');
      var dir2 = path.join('./tmp/_pouch_./', prefix);
      var dir3 = path.join(dir2, './tmp/_pouch_mydb');
      mkdirp.sync(dir);
      mkdirp.sync(dir2);
      mkdirp.sync(dir3);

      return new PouchDB('mydb', {
        prefix: prefix
      }).then(function (db) {
        return db.info().then(function (info1) {
          info1.db_name.should.equal('mydb');
          return db.destroy();
        });
      });
    });

    it('should allow us to set a prefix by default', function () {
      var prefix = './tmp/path/to/db/2/';
      var dir = path.join(prefix, '/tmp/');
      var dir2 = path.join('./tmp/_pouch_./', prefix);
      var dir3 = path.join(dir2, './tmp/_pouch_mydb');
      mkdirp.sync(dir);
      mkdirp.sync(dir2);
      mkdirp.sync(dir3);

      var CustomPouch = PouchDB.defaults({
        prefix: prefix
      });
      return new CustomPouch('mydb').then(function (db) {
        return db.info().then(function (info1) {
          info1.db_name.should.equal('mydb');
          return db.destroy();
        });
      });
    });

    it('should allow us to use memdown', function () {
      var opts = { name: 'mydb', db: require('memdown') };
      return new PouchDB(opts).then(function (db) {
        return db.put({_id: 'foo'}).then(function () {
          return new PouchDB('mydb').then(function (otherDB) {
            return db.info().then(function (info1) {
              return otherDB.info().then(function (info2) {
                info1.doc_count.should.not.equal(info2.doc_count);
                return otherDB.destroy();
              }).then(function () {
                return db.destroy();
              });
            });
          });
        });
      });
    });

    it('should allow us to destroy memdown', function () {
      var opts = {db: require('memdown') };
      return new PouchDB('mydb', opts).then(function (db) {
        return db.put({_id: 'foo'}).then(function () {
          return new PouchDB('mydb', opts).then(function (otherDB) {
            return db.info().then(function (info1) {
              return otherDB.info().then(function (info2) {
                info1.doc_count.should.equal(info2.doc_count);
                return otherDB.destroy();
              }).then(function () {
                return new PouchDB('mydb', opts).then(function (db3) {
                  return db3.info().then(function (info) {
                    info.doc_count.should.equal(0);
                    return db3.destroy();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should allow us to use memdown by default', function () {
      var CustomPouch = PouchDB.defaults({db: require('memdown')});
      return new CustomPouch('mydb').then(function (db) {
        return db.put({_id: 'foo'}).then(function () {
          return new PouchDB('mydb').then(function (otherDB) {
            return db.info().then(function (info1) {
              return otherDB.info().then(function (info2) {
                info1.doc_count.should.not.equal(info2.doc_count);
                return otherDB.destroy();
              }).then(function () {
                return db.destroy();
              });
            });
          });
        });
      });
    });
  });
}
