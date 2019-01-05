'use strict';


testCases.push(function (dbType, context) {
  describe(dbType + ': test.array.js', function () {

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
          var selector = {
            selector: {
              favorites: {
                $in: ["Mario"]
              }
            },
          };
          var db = context.db;
          return db.find(selector)
          .then(function (resp) {
          var docs = resp.docs.map(function (doc) {
            delete doc._rev;
            return doc;
          });

          docs.should.deep.equal([
            { name: 'James', _id: 'james',  favorites: ['Mario', 'Pokemon'], age: 20},
            { name: 'William', _id: 'william', favorites: ['Mario'], age: 23 }
          ]);

          return db.explain(selector);
        })
        .then(function (resp) {
          resp.index.name.should.deep.equal('_all_docs');
        });
      });

      it('should use name index', function () {
        var db = context.db;
        var selector = {
            selector: {
              name: {
                $in: ['James', 'Link']
              },
              age: {
                $gt: 21
              }
            },
          };
        return db.explain(selector)
        .then(function (resp) {
          resp.index.name.should.deep.equal('name-index');
          return db.find(selector);
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
            favorites: {
              $nin: ["TMNT"]
            }
          },
        }).then(function (resp) {
            resp.docs.should.have.length(4);
        });
      });

      it('should work for _id field', function () {
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
              {_id: 'link'},
              {_id: 'william'},
            ]);
        });
      });

      it('$nin work with complex array #6280', function () {
        var db = context.db;
        return context.db.bulkDocs([
          {
            _id: 'smith',
            lastName: 'Smith',
            absents: ['10/10/15', '10/10/16'],
            year: 2016,
            type: 'person'
          },
          {
            _id: 'roberts',
            lastName: 'Roberts',
            absents: ['10/10/10', '10/10/16'],
            year: 2017,
            type: 'person'
          },
          {
            _id: 'jones',
            lastName: 'Jones',
            absents: ['10/10/12', '10/10/20'],
            year: 2013,
            type: 'person'
          }
        ])
        .then(function () {
          return db.createIndex({
              index: {
                  fields: ['lastName','absents','year','type'],
                  name: 'myIndex',
                  ddoc: 'myIndex'
              }
            });
        })
        .then(function () {
          return db.find({
            selector: {
              lastName: {$gt: null},
              year: {$gt: null},
              type: 'person',
              absents: {
                $nin: ['10/10/15']
              }
            },
            fields: ["_id"]
          });
        })
        .then(function (resp) {
          resp.docs.should.deep.equal([
              {_id: 'jones'},
              {_id: 'roberts'},
            ]);
        });
      });
    });

    describe("$allMatch", function () {
      it("returns zero docs for field that is not an array", function () {
        var db = context.db;
        return db.find({
          selector: {
            name: {
              $allMatch: {
                _id: "mary"
              }
            }
          }
        })
        .then(function (resp) {
          resp.docs.length.should.equal(0);
        });
      });

      //CouchDB is returing a different result
      it.skip("returns false if field isn't in doc", function () {
        var docs = [
              {
                "user_id": "a",
                "bang": []
              }
          ];
          var db = context.db;
          return db.bulkDocs(docs)
          .then(function () {
            return db.find({
              selector: {
                bang: {
                  "$allMatch": {
                    "$eq": "Pokemon",
                  }
                }
              }
            });
          })
          .then(function (resp) {
            resp.docs.length.should.equal(0);
          });
      });

      it("matches against array", function () {
        var db = context.db;
        return db.find({
          selector: {
            favorites: {
              $allMatch: {
                $eq: "Pokemon"
              }
            }
          },
          fields: ["_id"]
        })
        .then(function (resp) {
          resp.docs.should.deep.equal([
            {_id: 'mary'},
          ]);
        });
      });

      it("works with object array", function () {
        var docs = [
              {
                "user_id": "a",
                "bang": [
                  {
                      "foo": 1,
                      "bar": 2
                  },
                  {
                      "foo": 3,
                      "bar": 4
                  }
                ]
              },
              {
                "user_id": "b",
                "bang": [
                  {
                    "foo": 1,
                    "bar": 2
                  },
                  {
                    "foo": 4,
                    "bar": 4
                  }
                ]
              }
          ];
          var db = context.db;
          return db.bulkDocs(docs)
          .then(function () {
            return db.find({
              selector: {
                bang: {
                  "$allMatch": {
                    "foo": {"$mod": [2,1]},
                    "bar": {"$mod": [2,0]}
                  }
                }
              },
              fields: ["user_id"]
            });
          })
          .then(function (resp) {
            resp.docs.should.deep.equal([
              {user_id: "a"}
            ]);
          });
      });
    });
  });
});
