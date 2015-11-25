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

    it('basic test with two operators', function () {
      var db = context.db;
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

    it('with object in array', function () {
      var db = context.db;
      var docs = [
        {_id: '1', events: [{eventId: 1, status: 'completed'}, {eventId: 2, status: 'started'}]},
        {_id: '2', events: [{eventId: 1, status: 'pending'}, {eventId: 2, status: 'finished'}]},
        {_id: '3', events: [{eventId: 1, status: 'pending'}, {eventId: 2, status: 'started'}]},
      ];

      return db.bulkDocs(docs).then(function () {
        return db.find({
          selector: {
            _id: {$gt: null},
            events: {$elemMatch: {"status": {$eq: 'pending'}, "eventId": {$eq: 1}}},
          },
          fields: ['_id']
        }).then(function (resp) {
          resp.docs.map(function (doc) {
            return doc._id;
          }).should.deep.equal(['2', '3']);
        });
      });
    });
  });
};
