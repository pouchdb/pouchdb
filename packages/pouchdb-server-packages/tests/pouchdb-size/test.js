var should = require('chai').should();
var PouchDB = require('pouchdb');
var memdown = require('memdown');
var sqldown = require('sqldown');
var medeadown = require('medeadown');
var jsondown = require('jsondown');
var locket = require('locket');
var Promise = require('bluebird');
var fse = Promise.promisifyAll(require("fs-extra"));

PouchDB.plugin(require('pouchdb-size'));

describe('pouchdb-size tests', function () {
  before(function () {
    return fse.mkdirAsync("b");
  });

  after(function () {
    return new PouchDB("a").destroy().then(function () {
      return new PouchDB('b/chello world!').destroy();
    }).then(function () {
      return fse.rmdirAsync("b");
    }).then(function () {
      return new PouchDB("e", {db: sqldown}).destroy();
    }).then(function () {
      return new PouchDB("./f", {db: medeadown}).destroy();
    }).then(function () {
      return fse.removeAsync("g");
    }).then(function () {
      return fse.removeAsync("h");
    });
  });

  it("should work in the normal case", function () {
    var db = new PouchDB('a');
    db.installSizeWrapper();
    var promise = db.info()
      .then(function (info) {
        info.disk_size.should.be.greaterThan(0);
      });
    promise.should.have.property("then");
    return promise;
  });

  it("should work with a weird name and a prefix", function () {
    var db = new PouchDB('hello world!', {prefix: "b/c"});
    db.installSizeWrapper();
    return db.info()
      .then(function (info) {
        info.disk_size.should.be.greaterThan(0);
      });
  });

  it("shouldn't disrupt a non-leveldb leveldown adapter", function () {
    var db = new PouchDB('d', {db: memdown});
    db.installSizeWrapper();
    var promise = db.info()
      .then(function (info) {
        should.not.exist(info.disk_size);
        info.db_name.should.equal("d");

        return db.getDiskSize()
          .then(function (size) {
            should.not.exist(size);
          })
          .catch(function (err) {
            //getDiskSize() should provide a more solid error.
            err.should.exist;
          });
      });
    promise.should.have.property("then");
    return promise;
  });

  it("shouldn't disrupt non-leveldown adapter", function (done) {
    //mock object
    var db = {
      type: function () {
        return "http";
      }
    };
    PouchDB.prototype.getDiskSize.call(db, function (err, size) {
      err.should.exist;
      should.not.exist(size);
      done();
    });
  });

  // PouchDB doesn't create a directory with sqldown, only a sqlite file
  // which means that at this point `pouchdb-size` is not compatible with
  // sqldown.
  it.skip("should work with sqldown", function () {
    var db = new PouchDB("e", {db: sqldown});
    db.installSizeWrapper();

    return db.getDiskSize()
      .then(function (size) {
        size.should.be.greaterThan(0);
        return db.info();
      })
      .then(function (info) {
        info.db_name.should.equal("e");
        info.disk_size.should.be.greaterThan(0);
      });
  });

  it("should work with medeadown", function () {
    // ./f instead of f is needed for medeadown.
    var db = new PouchDB("./f", {db: medeadown});
    db.installSizeWrapper();

    return db.info()
      .then(function (info) {
        info.db_name.should.equal("./f");
        info.disk_size.should.be.greaterThan(0);
      });
  });

  it("should work with jsondown", function () {
    var db = new PouchDB("g", {db: jsondown});
    db.installSizeWrapper();

    return db.getDiskSize()
      .then(function (size) {
        size.should.be.greaterThan(0);
        return db.info();
      })
      .then(function (info) {
        info.db_name.should.equal("g");
        info.disk_size.should.be.greaterThan(0);
      });
  });

  it("should work with locket", function () {
    var db = new PouchDB("h", {db: locket});
    db.installSizeWrapper();

    return db.info()
      .then(function (info) {
        info.db_name.should.equal("h");
        info.disk_size.should.be.greaterThan(0);
      });
  });
});
