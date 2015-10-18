'use strict';

var testUtils = require('../test-utils');
var should = testUtils.should;

module.exports = function (dbType, context) {
  describe(dbType + ': Combinational', function () {

    describe('$or', function () {

      it('does $or queries', function () {
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
              $and:[
                {age:{$gte: 75}},
                {$or: [
                  {"name.first": "Nancy"},
                  {"name.first": "Mick"}
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
              { _id: '1', age: 75, name: {first: 'Nancy', surname: 'Sinatra'}},
              { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}}
            ]);
        });
      });

      it('does $or queries 2', function () {
        var db = context.db;
        var index = {
          "index": {
            "fields": ["_id"]
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
            { _id: '5', age: 40, name: {first: 'Dave', surname: 'Grohl'}}
          ]);
        }).then(function () {
          return db.find({
            selector: {
              $and:[
                {_id:{$gte: '0'}},
                {$or: [
                  {"name.first": "Nancy"},
                  {age : {$lte: 40}}
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
              { _id: '1', age: 75, name: {first: 'Nancy', surname: 'Sinatra'}},
              { _id: '2', age: 40, name: {first: 'Eddie', surname: 'Vedder'}},
              { _id: '5', age: 40, name: {first: 'Dave', surname: 'Grohl'}}
            ]);
        });
      });

    });

    describe('$nor', function () {

      it('does $nor queries', function () {
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
              $and:[
                {age:{$gte: 75}},
                {$nor: [
                  {"name.first": "Nancy"},
                  {"name.first": "Mick"}
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
              { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}},
            ]);
        });
      });

      it('does $nor queries 2', function () {
        var db = context.db;
        var index = {
          "index": {
            "fields": ["_id"]
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
            { _id: '5', age: 40, name: {first: 'Dave', surname: 'Grohl'}}
          ]);
        }).then(function () {
          return db.find({
            selector: {
              $and:[
                {_id:{$lte: '6'}},
                {$nor: [
                  {"name.first": "Nancy"},
                  {age : {$lte: 40}}
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
              { _id: '3', age: 80, name: {first: 'John', surname: 'Fogerty'}},
              { _id: '4', age: 76, name: {first: 'Mick', surname: 'Jagger'}},
            ]);
        });
      });

      it('handles $or/$nor typos', function () {
        var db = context.db;
        var index = {
          "index": {
            "fields": ["_id"]
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
            { _id: '5', age: 40, name: {first: 'Dave', surname: 'Grohl'}}
          ]);
        }).then(function () {
          return db.find({
            selector: {
              $and:[
                {_id:{$lte: '6'}},
                {$noor: [
                  {"name.first": "Nancy"},
                  {age : {$lte: 40}}
                ]}
              ]
            }
          });
        }).then(function () {
          throw new Error('expected an error');
        }, function (err) {
          should.exist(err);
        });
      });

    });
  });

};
