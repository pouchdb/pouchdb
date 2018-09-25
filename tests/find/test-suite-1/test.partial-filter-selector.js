'use strict';

testCases.push(function (dbType, context) {

  describe(dbType + ': test.partial-filter-selector.js', function () {

    it('uses partial_filter_selector', function () {
      var db = context.db;
      return db.bulkDocs([
        { _id: 'bookmark:1' },
        { _id: 'list:1' }
      ]).then(function () {
        return db.createIndex({
          index: {
            partial_filter_selector: { _id: { $regex: '^bookmark:.+$' } },
            fields: ['_id'],
          },
          ddoc: 'bookmark-search',
        });
      }).then(function () {
        return db.find({
          selector: { _id: { $gt: null } },
          fields: ["_id"],
          use_index: 'bookmark-search',
        });
      }).then(function (resp) {
        resp.docs.should.deep.equal([
          { _id: 'bookmark:1' },
        ]);
      });
    });

  });
});
