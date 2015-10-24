'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': issue66', function () {

    beforeEach(function () {
      return context.db.bulkDocs([
        {
          name: 'Mario',
          _id: 'mario',
          rank: 5,
          series: 'Mario',
          debut: 1981,
          awesome: true
        },
        {
          name: 'Jigglypuff',
          _id: 'puff',
          rank: 8,
          series: 'Pokemon',
          debut: 1996,
          awesome: false
        },
        {
          name: 'Link',
          rank: 10,
          _id: 'link',
          series: 'Zelda',
          debut: 1986,
          awesome: true
        },
        {
          name: 'Donkey Kong',
          rank: 7,
          _id: 'dk',
          series: 'Mario',
          debut: 1981,
          awesome: false
        },
        {
          name: 'Pikachu',
          series: 'Pokemon',
          _id: 'pikachu',
          rank: 1,
          debut: 1996,
          awesome: true
        },
        {
          name: 'Captain Falcon',
          _id: 'falcon',
          rank: 4,
          series: 'F-Zero',
          debut: 1990,
          awesome: true
        },
        {
          name: 'Luigi',
          rank: 11,
          _id: 'luigi',
          series: 'Mario',
          debut: 1983,
          awesome: false
        },
        {
          name: 'Fox',
          _id: 'fox',
          rank: 3,
          series: 'Star Fox',
          debut: 1993,
          awesome: true
        },
        {
          name: 'Ness',
          rank: 9,
          _id: 'ness',
          series: 'Earthbound',
          debut: 1994,
          awesome: true
        },
        {
          name: 'Samus',
          rank: 12,
          _id: 'samus',
          series: 'Metroid',
          debut: 1986,
          awesome: true
        },
        {
          name: 'Yoshi',
          _id: 'yoshi',
          rank: 6,
          series: 'Mario',
          debut: 1990,
          awesome: true
        },
        {
          name: 'Kirby',
          _id: 'kirby',
          series: 'Kirby',
          rank: 2,
          debut: 1992,
          awesome: true
        },
        {
          name: 'Master Hand',
          _id: 'master_hand',
          series: 'Smash Bros',
          rank: 0,
          debut: 1999,
          awesome: false
        }
      ]);
    });

    it('should query all docs with $gt: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gt: null}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $lt: false', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lt: false}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lt: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lt: {}}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lte: {}}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: []', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lte: []}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lte: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lt: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lt: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $gt: false', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gt: false}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gte: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gte: 0}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gt: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gt: 0}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gte: false', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gte: false}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gt: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gt: {}}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gte: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gte: {}}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $eq: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$eq: {}}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $eq: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$eq: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $eq: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$eq: 0}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $eq: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$eq: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$lte: 0}
            }
          }).then(function (response) {
            response.docs = response.docs.map(function (doc) {
              return doc._id;
            });
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $gte: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            selector: {
              _id: {$gte: null}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gt: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gt: null}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $lt: false', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lt: false}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lt: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lt: {}}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lte: {}}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: []', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lte: []}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lte: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lt: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lt: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $gt: false', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gt: false}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gte: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gte: 0}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gt: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gt: 0}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gte: false', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gte: false}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gt: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gt: {}}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $gte: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gte: {}}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });

    it('should query all docs with $eq: {}', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$eq: {}}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $eq: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$eq: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $eq: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$eq: 0}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $eq: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$eq: null}
            }
          }).then(function (response) {
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $lte: 0', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$lte: 0}
            }
          }).then(function (response) {
            response.docs = response.docs.map(function (doc) {
              return doc._id;
            });
            response.docs.should.deep.equal([]);
          });
        });
    });

    it('should query all docs with $gte: null', function () {
      var db = context.db;
      return db.bulkDocs(
        [{_id: 'a'}, {_id: 'b'}, {_id: 'c'}]
      ).then(function () {
          return db.find({
            sort: [{_id: 'desc'}], selector: {
              _id: {$gte: null}
            }
          }).then(function (response) {
            response.docs.map(function (doc) {
              return doc._id;
            }).sort().should.deep.equal(
              ['a', 'b', 'c', 'dk', 'falcon', 'fox', 'kirby', 'link', 'luigi',
                'mario', 'master_hand', 'ness', 'pikachu', 'puff', 'samus',
                'yoshi']
            );
          });
        });
    });
  });
};