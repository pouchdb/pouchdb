'use strict';

module.exports = function (dbType, context) {

  describe(dbType + ': ne', function () {

    it.skip('does ne queries', function () {
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
          selector: {foo: {$ne: "eba"}},
          fields: ["_id", "foo"],
          sort: [{foo: "asc"}]
        });
      }).then(function (resp) {
        resp.should.deep.equal({
          docs: [
            { _id: '4', foo: 'abo'},
            { _id: '2', foo: 'ebb'},
            { _id: '1', foo: 'eyo'}
          ]
        });
      });
    });

  });
};