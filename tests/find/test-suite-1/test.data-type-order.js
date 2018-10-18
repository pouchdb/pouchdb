'use strict';

testCases.push(function (dbType, context) {

  describe(dbType + ': test.data-type-order.js', function () {
    it('Orders different data types correctly', function () {
      var db = context.db;
      return db.createIndex({
        index: {
            fields: ['foo']
        }
      }).then(function () {
          return db.bulkDocs([
            // intentional random bulk order
            {_id: '8', foo: 'foo'},
            {_id: '5', foo: 0},
            {_id: '3', foo: true},
            {_id: '2', foo: false},
            {_id: '6', foo: 42},
            {_id: '9', foo: [0]},
            {_id: '10', foo: ['foo']},
            {_id: '7', foo: ''},
            {_id: '4', foo: -42},
            {_id: '1', foo: null},
          ]).then(function () {
            return db.find({
              selector: {
                foo: {$lt: 0}
              },
              sort: [{foo: 'desc'}],
              fields: ['_id'],
            });
          }).then(function (resp) {
            resp.docs.should.deep.equal([
              {_id: '4'},
              {_id: '3'},
              {_id: '2'},
              {_id: '1'},
            ]);
          }).then(function () {
            return db.find({
              selector: {
                foo: {$gt: 0}
              },
              fields: ['_id'],
            });
          }).then(function (resp) {
            console.log(JSON.stringify(resp.docs, null, 2));
            resp.docs.should.deep.equal([
              {_id: '6'},
              {_id: '7'},
              {_id: '8'},
              {_id: '9'},
              {_id: '10'},
            ]);
          });
      });
    });

    // IndexedDB does not index obejcts, so this test fails in idbnext. It is probably
    // impossible to fix this. Unlike booleans and null, we can't remap objects cleanly,
    // because:
    //   a) they aren't constants, they could have anything in them
    //   b) because someone else might want them to actually index on the inner parts
    //      of the object (in this case, foo.foo)
    it.skip('Orders different data types correctly, including objects', function () {
      var db = context.db;
      return db.createIndex({
        index: {
            fields: ['foo']
        }
      }).then(function () {
          return db.bulkDocs([
            // intentional random bulk order
            {_id: '8', foo: 'foo'},
            {_id: '5', foo: 0},
            {_id: '11', foo: {foo: 0}},
            {_id: '3', foo: true},
            {_id: '2', foo: false},
            {_id: '6', foo: 42},
            {_id: '12', foo: {foo: 'foo'}},
            {_id: '9', foo: [0]},
            {_id: '10', foo: ['foo']},
            {_id: '7', foo: ''},
            {_id: '4', foo: -42},
            {_id: '1', foo: null},
          ]).then(function () {
            return db.find({
              selector: {
                foo: {$lt: 0}
              },
              sort: [{foo: 'desc'}],
              fields: ['_id'],
            });
          }).then(function (resp) {
            resp.docs.should.deep.equal([
              {_id: '4'},
              {_id: '3'},
              {_id: '2'},
              {_id: '1'},
            ]);
          }).then(function () {
            return db.find({
              selector: {
                foo: {$gt: 0}
              },
              fields: ['_id'],
            });
          }).then(function (resp) {
            console.log(JSON.stringify(resp.docs, null, 2));
            resp.docs.should.deep.equal([
              {_id: '6'},
              {_id: '7'},
              {_id: '8'},
              {_id: '9'},
              {_id: '10'},
              {_id: '11'},
              {_id: '12'},
            ]);
          });
      });
    });

    // In IndexedDB we rewrite true, false and null as Number.MIN_SAFE_INTEGER
    // because IndexedDB doesn't support indexing those values. This test checks
    // that we're also dealing with order correctly when users actually store
    // Number.MIN_SAFE_INTEGER
    //
    // IMO this is low priority to fix, since it isn't likely to occur and requires
    // either a heavy weight sort in many cases, or careful custom sorting
    it.skip('Orders min numbers correctly', function () {
      var db = context.db;
      return db.createIndex({
        index: {
          fields: ['foo']
        }
      }).then(function () {
        return db.bulkDocs([
          // intentional random order
          {_id: '4', foo: Number.MIN_SAFE_INTEGER},
          {_id: '7', foo: null},
          {_id: '2', foo: Number.MIN_SAFE_INTEGER + 2},
          {_id: '5', foo: true},
          {_id: '6', foo: false},
          {_id: '1', foo: -42},
          {_id: '3', foo: Number.MIN_SAFE_INTEGER + 1},
        ]).then(function () {
          return db.find({
            selector: {
              foo: {$lt: 0}
            },
            sort: [{foo: 'desc'}],
            fields: ['_id'],
          });
        }).then(function (resp) {
          console.log(JSON.stringify(resp.docs, null, 2));
          resp.docs.should.deep.equal([
            {_id: '1'},
            {_id: '2'},
            {_id: '3'},
            {_id: '4'},
            {_id: '5'},
            {_id: '6'},
            {_id: '7'},
          ]);
        });
      });
    });
  });
});
