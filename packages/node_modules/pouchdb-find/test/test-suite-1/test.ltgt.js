'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': ltgt', function () {
    it('does gt queries', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {"$gt": "eb"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '3', foo: 'eba'},
            {_id: '2', foo: 'ebb'},
            {_id: '1', foo: 'eyo'}
          ]
        });
      });
    });

    it('does lt queries', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {"$lt": "eb"}},
          fields: ["_id", "foo"]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '4', foo: 'abo'}
          ]
        });
      });
    });

    it('#20 - lt queries with sort descending return correct number of docs', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["debut"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', debut: 1983},
          { _id: '2', debut: 1981},
          { _id: '3', debut: 1989},
          { _id: '4', debut: 1990}
        ]);
      }).then(function () {
        return db.find({
          selector: {debut: {$lt: 1990}},
          sort: [{debut: 'desc'}]
        });
      }).then(function (resp) {
        var docs = resp.docs.map(function (x) { delete x._rev; return x; });
        docs.should.deep.equal([
          { _id: '3', debut: 1989},
          { _id: '1', debut: 1983},
          { _id: '2', debut: 1981}
        ]);
      });
    });
    // ltge - {include_docs: true, reduce: false, descending: true, startkey: 1990}
    // lt no sort {include_docs: true, reduce: false, endkey: 1990, inclusive_end: false}
    // lt sort {include_docs: true, reduce: false, descending: true, 
    // startkey: 1990, inclusive_start: false}

    it('does lte queries', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {"$lte": "eba"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '4', foo: 'abo'},
            {_id: '3', foo: 'eba'},
          ]
        });
      });
    });

    it('#41 another complex multifield query', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["datetime"]
        }
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          {_id: '1',
            datetime: 1434054640000,
            glucoseType: 'fasting',
            patientId: 1
          },
          {_id: '2',
            datetime: 1434054650000,
            glucoseType: 'fasting',
            patientId: 1
          },
          {_id: '3',
            datetime: 1434054660000,
            glucoseType: 'fasting',
            patientId: 1
          },
          {_id: '4',
            datetime: 1434054670000,
            glucoseType: 'fasting',
            patientId: 1
          }
        ]);
      }).then(function () {
        return db.find({
          selector: {
            datetime: { "$lt": 1434054660000 },
            glucoseType: { "$eq": 'fasting' },
            patientId: { "$eq": 1 }
          }
        });
      }).then(function (res) {
        var docs = res.docs.map(function (x) { delete x._rev; return x; });
        docs.should.deep.equal([
          {
            "_id": "1",
            "datetime": 1434054640000,
            "glucoseType": "fasting",
            "patientId": 1
          },
          {
            "_id": "2",
            "datetime": 1434054650000,
            "glucoseType": "fasting",
            "patientId": 1
          }
        ]);
      });
    });

    it('does gt queries, desc sort', function () {
      var db = context.db;
      var index = {
        "index": {
          "fields": ["foo"]
        },
        "name": "foo-index",
        "type": "json"
      };

      return db.createIndex(index).then(function () {
        return db.bulkDocs([
          { _id: '1', foo: 'eyo'},
          { _id: '2', foo: 'ebb'},
          { _id: '3', foo: 'eba'},
          { _id: '4', foo: 'abo'}
        ]);
      }).then(function () {
        return db.find({
          selector: {foo: {"$gt": "eb"}},
          fields: ["_id", "foo"],
          sort: [{foo: "desc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            {_id: '1', foo: 'eyo'},
            {_id: '2', foo: 'ebb'},
            {_id: '3', foo: 'eba'}
          ]
        });
      });
    });

    it('#38 $gt with dates', function () {
      var db = context.db;

      var startDate = "2015-05-25T00:00:00.000Z";
      var endDate = "2015-05-26T00:00:00.000Z";

      return db.createIndex({
        index: {
          fields: ['docType', 'logDate']
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: '1', docType: 'log', logDate: "2015-05-24T00:00:00.000Z"},
          {_id: '2', docType: 'log', logDate: "2015-05-25T00:00:00.000Z"},
          {_id: '3', docType: 'log', logDate: "2015-05-26T00:00:00.000Z"},
          {_id: '4', docType: 'log', logDate: "2015-05-27T00:00:00.000Z"}
        ]);
      }).then(function() {
        return db.find({
          selector: {docType: 'log'}
        }).then(function (result) {
          result.docs.map(function (x) { delete x._rev; return x; }).should.deep.equal([
            {
              "_id": "1",
              "docType": "log",
              "logDate": "2015-05-24T00:00:00.000Z"
            },
            {
              "_id": "2",
              "docType": "log",
              "logDate": "2015-05-25T00:00:00.000Z"
            },
            {
              "_id": "3",
              "docType": "log",
              "logDate": "2015-05-26T00:00:00.000Z"
            },
            {
              "_id": "4",
              "docType": "log",
              "logDate": "2015-05-27T00:00:00.000Z"
            }
          ], 'test 1');
        });
      }).then(function () {
        return db.find({
          selector: {docType: 'log', logDate: {$gt: startDate}}
        }).then(function (result) {
          result.docs.map(function (x) { delete x._rev; return x; }).should.deep.equal([
            {
              "_id": "3",
              "docType": "log",
              "logDate": "2015-05-26T00:00:00.000Z"
            },
            {
              "_id": "4",
              "docType": "log",
              "logDate": "2015-05-27T00:00:00.000Z"
            }
          ], 'test 2');
        });
      }).then(function () {
        return db.find({
          selector: {docType: 'log', logDate: {$gte: startDate}}
        }).then(function (result) {
          result.docs.map(function (x) { delete x._rev; return x; }).should.deep.equal([
            {
              "_id": "2",
              "docType": "log",
              "logDate": "2015-05-25T00:00:00.000Z"
            },
            {
              "_id": "3",
              "docType": "log",
              "logDate": "2015-05-26T00:00:00.000Z"
            },
            {
              "_id": "4",
              "docType": "log",
              "logDate": "2015-05-27T00:00:00.000Z"
            }
          ], 'test 3');
        });
      }).then(function () {
        return db.find({
          selector: {
            docType: 'log',
            logDate: {$gte: startDate, $lte: endDate}
          }
        }).then(function (result) {
          result.docs.map(function (x) { delete x._rev; return x; }).should.deep.equal([
            {
              "_id": "2",
              "docType": "log",
              "logDate": "2015-05-25T00:00:00.000Z"
            },
            {
              "_id": "3",
              "docType": "log",
              "logDate": "2015-05-26T00:00:00.000Z"
            }
          ], 'test 4');
        });
      });
    });

    it('bunch of equivalent queries', function () {
      var db = context.db;

      function normalize(res) {
        return res.docs.map(function getId(x) {
          return x._id;
        }).sort();
      }

      return db.createIndex({
        index: {
          fields: ['foo']
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: '1', foo: 1},
          {_id: '2', foo: 2},
          {_id: '3', foo: 3},
          {_id: '4', foo: 4}
        ]);
      }).then(function() {
        return db.find({
          selector: { $and: [{foo: {$gt: 2}}, {foo: {$gte: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['3', '4']);
        return db.find({
          selector: { $and: [{foo: {$eq: 2}}, {foo: {$gte: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['2']);
        return db.find({
          selector: { $and: [{foo: {$eq: 2}}, {foo: {$lte: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['2']);
        return db.find({
          selector: { $and: [{foo: {$lte: 3}}, {foo: {$lt: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1', '2']);
        return db.find({
          selector: { $and: [{foo: {$eq: 4}}, {foo: {$gte: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['4']);
        return db.find({
          selector: { $and: [{foo: {$lte: 3}}, {foo: {$eq: 1}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
        return db.find({
          selector: { $and: [{foo: {$eq: 4}}, {foo: {$gt: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['4']);
        return db.find({
          selector: { $and: [{foo: {$lt: 3}}, {foo: {$eq: 1}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
      });
    });

    it('bunch of equivalent queries 2', function () {
      var db = context.db;

      function normalize(res) {
        return res.docs.map(function getId(x) {
          return x._id;
        }).sort();
      }

      return db.createIndex({
        index: {
          fields: ['foo']
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: '1', foo: 1},
          {_id: '2', foo: 2},
          {_id: '3', foo: 3},
          {_id: '4', foo: 4}
        ]);
      }).then(function() {
        return db.find({
          selector: { $and: [{foo: {$gt: 2}}, {foo: {$gte: 1}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['3', '4']);
        return db.find({
          selector: { $and: [{foo: {$lt: 3}}, {foo: {$lte: 4}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1', '2']);
        return db.find({
          selector: { $and: [{foo: {$gt: 2}}, {foo: {$gte: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['3', '4']);
        return db.find({
          selector: { $and: [{foo: {$lt: 3}}, {foo: {$lte: 1}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
        return db.find({
          selector: { $and: [{foo: {$gte: 2}}, {foo: {$gte: 1}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['2', '3', '4']);
        return db.find({
          selector: { $and: [{foo: {$lte: 3}}, {foo: {$lte: 4}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1', '2', '3']);
        return db.find({
          selector: { $and: [{foo: {$gt: 2}}, {foo: {$gt: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['4']);
        return db.find({
          selector: { $and: [{foo: {$lt: 3}}, {foo: {$lt: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
      });
    });

    it('bunch of equivalent queries 3', function () {
      var db = context.db;

      function normalize(res) {
        return res.docs.map(function getId(x) {
          return x._id;
        }).sort();
      }

      return db.createIndex({
        index: {
          fields: ['foo']
        }
      }).then(function () {
        return db.bulkDocs([
          {_id: '1', foo: 1},
          {_id: '2', foo: 2},
          {_id: '3', foo: 3},
          {_id: '4', foo: 4}
        ]);
      }).then(function() {
        return db.find({
          selector: { $and: [{foo: {$gte: 1}}, {foo: {$gt: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['3', '4']);
        return db.find({
          selector: { $and: [{foo: {$lte: 4}}, {foo: {$lt: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1', '2']);
        return db.find({
          selector: { $and: [{foo: {$gte: 3}}, {foo: {$gt: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['3', '4']);
        return db.find({
          selector: { $and: [{foo: {$lte: 1}}, {foo: {$lt: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
        return db.find({
          selector: { $and: [{foo: {$gte: 1}}, {foo: {$gte: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['2', '3', '4']);
        return db.find({
          selector: { $and: [{foo: {$lte: 4}}, {foo: {$lte: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1', '2', '3']);
        return db.find({
          selector: { $and: [{foo: {$gt: 3}}, {foo: {$gt: 2}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['4']);
        return db.find({
          selector: { $and: [{foo: {$lt: 2}}, {foo: {$lt: 3}}]}
        });
      }).then(function (res) {
        normalize(res).should.deep.equal(['1']);
      });
    });

  });
};
