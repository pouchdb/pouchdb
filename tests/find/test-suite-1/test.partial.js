'use strict';

testCases.push(function (dbType, context) {
  describe(`${dbType}: test.partial.js`, function () {
    beforeEach(function (done) {
      const write = context.db.bulkDocs({ docs: [
        { _id: 'a', type: 'x', hello: 'world' },
        { _id: 'a', type: 'y', hello: 'world' }
      ]});
      const index = context.db.createIndex({
        index: {
          fields: ['hello'],
          partial_filter_selector: { type: 'x' }
        },
        ddoc: 'test-partial',
        name: 'type-x'
      });
      Promise.all([write, index]).then(() => {
        done();
      });
    });
    it('should apply the partial filter', function (done) {
      context.db.find({
        selector: { hello: 'world' },
        use_index: ['_design/test-partial', 'type-x']
      }).then((result) => {
        result.should.deep.equals({
          docs: [{ _id: 'a', type: 'x', hello: 'world' }]
        });
        done();
      });
    });
  });
});
