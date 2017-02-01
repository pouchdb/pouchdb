'use strict';


module.exports = function (dbType, context) {
  describe(dbType + ': Array', function () {

    beforeEach(function () {
      return context.db.bulkDocs([
        { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20 },
        { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'], age: 21 },
        { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22},
        { name: 'William', _id: 'william', favorites: ['Mario'], age: 23}
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
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20},
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
          ]);
        });
      });

      it('should use default index due to non-logical operators', function () {
        var db = context.db;
        var index = {
          "index": {
            "fields": ["name", "age"]
          },
          "type": "json"
        };
        return db.createIndex(index)
        .then(function () {
          return db.find({
            selector: {
              name: {
                $in: ['James', 'Link']
              },
              age: {
                $gt: 21
              }
            },
          });
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22},
          ]);
        });
      });

      it('should return docs match single value in array with defined index', function () {
        var db = context.db;
        var index = {
          "index": {
            "fields": ["name", "favorites"]
          },
          "type": "json"
        };
        return db.createIndex(index)
        .then(function () {
          return db.find({
            selector: {
              name: {
                $eq: 'James'
              },
              favorites: {
                $in: ["Mario"]
              }
            },
          });
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20}
          ]);
        });
      });


      it('should return docs match single field that is not an array', function () {
        var db = context.db;
        return db.find({
          selector: {
            _id: {
              $gt: 'a'
            },
            name: {
              $in: ['James', 'William']
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20 },
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
          ]);
        });
      });

      it('should return docs match single field that is not an array and number', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            age: {
              $in: [20, 23]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20 },
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
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
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20 },
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22},
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
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
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20},
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23}
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
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20},
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
            { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'], age: 21 },
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
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
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20 },
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22 },
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
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22},
            { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'], age: 21 },
          ]);
        });
      });

      it('should return docs that do not match single field that is not an array', function () {
        var db = context.db;
        return db.find({
          selector: {
            _id: {
              $gt: 'a'
            },
            name: {
              $nin: ['James', 'William']
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22},
            { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'], age: 21 },
          ]);
        });
      });

      it('should return docs with single field that is not an array and number', function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $gt: null
            },
            age: {
              $nin: [20, 23]
            }
          },
        }).then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'Link', _id: 'link', favorites: ['Zelda', 'Pokemon'], age: 22},
            { name: 'Mary', _id: 'mary',  favorites: ['Pokemon'], age: 21 },
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
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
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

      //Currently Mango is returning a design doc which isn't correct
      it.skip('should work for _id field', function () {
        var db = context.db;
        return db.find({
          selector: {
            _id: {
              $nin: ['james', 'mary']
            }
          },
          fields: ["_id"]
        }).then(function (resp) {
            resp.docs.should.deep.equal([
      //        {_id: '_design/37ca0de9e0e68521c0eca0239d9b29c5027ae7ea'},
              {_id: 'link'},
              {_id: 'william'},
            ]);
        });
      });
    });
  });
};
