'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': $elemMatch', function () {
    if (dbType === 'http') { return;}

    beforeEach(function () {
      return context.db.bulkDocs([
        {'_id': 'peach', eats: ['cake', 'turnips', 'sweets'], results: [ 82, 85, 88 ]},
        {'_id': 'sonic', eats: ['chili dogs'], results: [ 75, 88, 89 ]},
        {'_id': 'fox',   eats: []},
        {'_id': 'mario', eats: ['cake', 'mushrooms']},
        {'_id': 'samus', eats: ['pellets']},
        {'_id': 'kirby', eats: 'anything', results: [ 82, 86, 10 ]}
      ]);
    });

    it('basic test', function () {
      var db = context.db;
      var index = {index: {fields: ['_id']}};
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {
            _id: {$gt: 'a'},
            eats: {$elemMatch: {$eq: 'cake'}}
          }
        }).then(function (resp) {
          resp.docs.map(function (doc) {
            return doc._id;
          }).sort().should.deep.equal(['mario', 'peach']);
        });
      });
    });

    it('basic test with two operators', function () {
      var db = context.db;
      var index = {index: {fields: ['_id']}};
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {
            _id: {$gt: 'a'},
            results: {$elemMatch: {$gte: 80, $lt: 85}}
          }
        }).then(function (resp) {
          resp.docs.map(function (doc) {
            return doc._id;
          }).should.deep.equal(['kirby', 'peach']);
        });
      });
    });
  });
};
