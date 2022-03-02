'use strict';

describe('test.type.js', function () {
  var sortById = testUtils.sortById;

  beforeEach(function () {
    var db = context.db;
    return db.bulkDocs([
      {_id: 'a', foo: 'bar'},
      {_id: 'b', foo: 1},
      {_id: 'c', foo: null},
      {_id: 'd', foo: []},
      {_id: 'e', foo: {}},
      {_id: 'f', foo: false}
    ]);
  });

  it('does null', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'null'}
      },
      fields: ['_id']
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'c'}]);
    });
  });

  it('does boolean', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'boolean'}
      },
      fields: ['_id']
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'f'}]);

    });
  });

  it('does number', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'number'}
      },
      fields: ['_id']
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'b'}]);
    });
  });

  it('does string', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'string'}
      },
      fields: ['_id']
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'a'}]);
    });
  });

  it('does array', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'array'}
      },
      fields: ['_id']
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'd'}]);
    });
  });

  it('does object', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'object'}
      },
      fields: ['_id']
    }).then(function (res) {
      res.docs.sort(sortById);
      res.docs.should.deep.equal([{_id: 'e'}]);
    });
  });

  it('should error for unsupported query value', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 'made-up'}
      },
      fields: ['_id']
    }).catch(function (err) {
      err.message.should.eq('Query operator $type must be a string. Supported values: "null", "boolean", "number", "string", "array", or "object". Received string: made-up');
    });
  });
  it('should error for non-string query value', function () {
    var db = context.db;
    return db.find({
      selector: {
        'foo': {$type: 0}
      },
      fields: ['_id']
    }).then(function () {
      throw new Error('Function should throw');
    }, function (err) {
      err.message.should.eq('Query operator $type must be a string. Supported values: "null", "boolean", "number", "string", "array", or "object". Received number: 0');
    });
  });
});
