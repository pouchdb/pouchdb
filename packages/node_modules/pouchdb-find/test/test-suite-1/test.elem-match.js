'use strict';

module.exports = function (dbType, context) {
  describe(dbType + ': $elemMatch', function () {

    beforeEach(function () {
      return context.db.bulkDocs([
        {'_id': 'peach', eats: ['cake', 'turnips', 'sweets']},
        {'_id': 'sonic', eats: ['chili dogs']},
        {'_id': 'fox',   eats: []},
        {'_id': 'mario', eats: ['cake', 'mushrooms']},
        {'_id': 'samus', eats: ['pellets']},
        {'_id': 'kirby', eats: 'anything'}
      ]);
    });

    it('basic test', function () {
      var db = context.db;
      var index = {index: {fields: ['eats']}};
      return db.createIndex(index).then(function () {
        return db.find({
          selector: {eats: {$elemMatch: {$eq: 'cake'}}}
        }).then(function (resp) {
          resp.docs.map(function (doc) {
            return doc._id;
          }).sort().should.deep.equal(['mario', 'peach']);
        });
      });
    });
  });
};
