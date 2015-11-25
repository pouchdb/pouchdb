'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': $not', function () {

    it('works with simple syntax', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["age"]
        },
        "name": "age-index",
      "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', age: 75, name: {first: 'Nancy', surname: 'Sinatra'}},
          { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
          { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}},
          { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
        ]);
      }).then(function () {
        return db.find({
          selector: {
            age:{$gte: 40},
            $not:{age: 75},
          }
        });
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
            { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
            { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
            { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}}
        ]);
      });
    });

    it('works with $and', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["age"]
        },
        "name": "age-index",
      "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', age: 75, name: {first: 'Nancy', surname: 'Sinatra'}},
          { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
          { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}},
          { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
        ]);
      }).then(function () {
        return db.find({
          selector: {
            $and: [
              {age:{$gte: 40}},
              {$not:{age: {$eq: 75}}},
            ]
          }
        });
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
            { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
            { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
            { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}}
        ]);
      });
    });

    it('works with another combinational field', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["age"]
        },
        "name": "age-index",
      "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', age: 75, name: {first: 'Nancy', surname: 'Sinatra'}},
          { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
          { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}},
          { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
        ]);
      }).then(function () {
        return db.find({
          selector: {
            $and: [
              {age:{$gte: 0}},
              {$not:{age: {$eq: 75}}},
              {$or: [
                {"name.first": "Eddie"},
              ]}
            ]
          }
        });
      }).then(function (resp) {
        var docs = resp.docs.map(function (doc) {
          delete doc._rev;
          return doc;
        });

        docs.should.deep.equal([
            { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
        ]);
      });
    });
  });
};
