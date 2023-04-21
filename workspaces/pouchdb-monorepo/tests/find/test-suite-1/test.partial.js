'use strict';

describe('test.partial.js', function () {
  beforeEach(function () {
    const write = context.db.bulkDocs({ docs: [
      { _id: 'a', type: 'x', hello: 'world' },
      { _id: 'b', type: 'y', hello: 'world' }
    ]});
    const index = context.db.createIndex({
      index: {
        fields: ['hello'],
        partial_filter_selector: { type: 'x' }
      },
      ddoc: 'test-partial',
      name: 'type-x'
    });
    return Promise.all([write, index]);
  });

  it('should write the partial filter to the ddoc', async function () {
    const result = await context.db.get('_design/test-partial');
    const map = result.views['type-x'].map;
    map.should.have.property('partial_filter_selector');
    map.partial_filter_selector.should.deep.equal({
      type: {
        '$eq': 'x'
      }
    });
  });

  it('should apply the partial filter', async function () {
    const result = await context.db.find({
      selector: { hello: 'world' },
      use_index: ['_design/test-partial', 'type-x']
    });
    result.docs.should.have.length(1);
    const [{ _id: id, type, hello }] = result.docs;
    id.should.equal('a');
    type.should.equal('x');
    hello.should.equal('world');
  });
});
