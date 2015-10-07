'use strict';


module.exports = function (dbType, context) {
  describe(dbType + ': Array', function () {

    beforeEach(function () {
      return context.db.bulkDocs([
        { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'] },
        { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'] },
        { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon']},
        { name: 'William', _id: 'william', favorites: ['Mario'] }
      ]).then(function () {
        var index = {
          "index": {
            "fields": ["name"]
          },
          "name": "name-index",
          "type": "json"
        };
        return context.db.createIndex(index);
      });
    });

    describe('$in', function () {
      it('should return docs match single value in array', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $in: ["Mario"]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'] },
            { name: 'William', _id: 'william', favorites: ['Mario'] }
          ]);
        });
      });

      it('should return docs match two values in array', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $in: ["Mario", "Zelda"]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'] },
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon']},
            { name: 'William', _id: 'william', favorites: ['Mario'] }
          ]);
        });
      });

      it('should return no docs for no $in match', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $in: ["TMNT"]
            }
          },
        }).then(function (resp) {
            resp.docs.should.have.length(0);
        });
      });
    });

    describe('$all', function () {
      it('should return docs that match single value in $all array', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $all: ["Mario"]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'] },
            { name: 'William', _id: 'william', favorites: ['Mario'] }
          ]);
        });
      });

      it('should return docs match two values in $all array', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $all: ['Mario', 'Pokemon']
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'] },
          ]);
        });
      });

      it('should return no docs for no match for $all', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $all: ["Mario", "Zelda"]
            }
          },
        }).then(function (resp) {
            resp.docs.should.have.length(0);
        });
      });
    });

    describe('$size', function () {
      it('should return docs with array length 1', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $size: 1
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'] },
            { name: 'William', _id: 'william', favorites: ['Mario'] }
          ]);
        });
      });

      it('should return docs array length 2', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $size: 2
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'] },
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon']},
          ]);
        });
      });

      it('should return no docs for length 5', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $size: 5
            }
          },
        }).then(function (resp) {
            resp.docs.should.have.length(0);
        });
      });
    });

    describe('$nin', function () {
      it('should return docs match single value $nin array', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $nin: ["Mario"]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon']},
            { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'] },
          ]);
        });
      });

      it('should return docs that do not match two values $nin array', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $nin: ["Pokemon", "Zelda"]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'William', _id: 'william', favorites: ['Mario'] }
          ]);
        });
      });

      it('should return all docs for no match for $nin', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            favorites: {
              $nin: ["TMNT"]
            }
          },
        }).then(function (resp) {
            resp.docs.should.have.length(4);
        });
      });
    });
  });
};
