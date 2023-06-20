'use strict';

var memdown = require('memdown');
var PouchDB = require('../../packages/pouchdb-for-coverage');
var genReplicationId = PouchDB.utils.generateReplicationId;
var sourceDb = new PouchDB({name: 'local_db', db: memdown});
var targetDb = new PouchDB({name: 'target_db', db: memdown});

require('chai').should();

describe('test.gen-replication-id.js', function () {
  it('is different with different `doc_ids` option', function () {
    var opts2 = {doc_ids: ["1"]};
    var opts1 = {doc_ids: ["2"]};

    return genReplicationId(sourceDb, targetDb, opts1).then(
      function (replicationId1) {
        return genReplicationId(sourceDb, targetDb, opts2).then(
          function (replicationId2) {
            replicationId2.should.not.eql(replicationId1);
          }
        );
      }
    );
  });

  it('ignores the order of array elements in the `doc_ids` option',
    function () {
      var opts1 = {doc_ids: ["1", "2", "3"]};
      var opts2 = {doc_ids: ["3", "2", "1"]};

      return genReplicationId(sourceDb, targetDb, opts1).then(
        function (replicationId1) {
          return genReplicationId(sourceDb, targetDb, opts2).then(
            function (replicationId2) {
              replicationId2.should.eql(replicationId1);
            }
          );
        }
      );
    }
  );

  it('is different with different `filter` option', function () {
    var opts1 = {filter: 'ddoc/filter'};
    var opts2 = {filter: 'ddoc/other_filter'};

    return genReplicationId(sourceDb, targetDb, opts1).then(
      function (replicationId1) {
        return genReplicationId(sourceDb, targetDb, opts2).then(
          function (replicationId2) {
            replicationId2.should.not.eql(replicationId1);
          }
        );
      }
    );
  });

  it('ignores the `query_params` option if there\'s no `filter` option',
    function () {
      var opts1 = {query_params: {foo: 'bar'}};
      var opts2 = {query_params: {bar: 'baz'}};

      return genReplicationId(sourceDb, targetDb, opts1).then(
        function (replicationId1) {
          return genReplicationId(sourceDb, targetDb, opts2).then(
            function (replicationId2) {
              replicationId2.should.eql(replicationId1);
            }
          );
        }
      );
    }
  );

  it('is different with same `filter` but different `query_params` option',
    function () {
      var opts1 = {filter: 'ddoc/filter', query_params: {foo: 'bar'}};
      var opts2 = {filter: 'ddoc/other_filter'};

      return genReplicationId(sourceDb, targetDb, opts1).then(
        function (replicationId1) {
          return genReplicationId(sourceDb, targetDb, opts2).then(
            function (replicationId2) {
              replicationId2.should.not.eql(replicationId1);
            }
          );
        }
      );
    }
  );

  it('ignores the order of object properties in the `query_params` option',
    function () {
      var opts1 = {
        filter: 'ddoc/filter',
        query_params: {foo: 'bar', bar: 'baz'}
      };
      var opts2 = {
        filter: 'ddoc/filter',
        query_params: {bar: 'baz', foo: 'bar'}
      };

      return genReplicationId(sourceDb, targetDb, opts1).then(
        function (replicationId1) {
          return genReplicationId(sourceDb, targetDb, opts2).then(
            function (replicationId2) {
              replicationId2.should.eql(replicationId1);
            }
          );
        }
      );
    }
  );

  it('it ignores the `view` option unless the `filter` option value ' +
     'is `_view`',
    function () {
      var opts1 = {view: 'ddoc/view'};
      var opts2 = {view: 'ddoc/other_view'};
      var opts3 = {filter: 'ddoc/view', view: 'ddoc/view'};
      var opts4 = {filter: 'ddoc/view', view: 'ddoc/other_view'};
      var opts5 = {filter: '_view', view: 'ddoc/other_view'};
      var opts6 = {filter: '_view', view: 'ddoc/view'};

      return genReplicationId(sourceDb, targetDb, opts1).then(
        function (replicationId1) {
          return genReplicationId(sourceDb, targetDb, opts2).then(
            function (replicationId2) {
              replicationId2.should.eql(replicationId1);
              return replicationId2;
            }
          );
        }
      ).then(function (replicationId2) {
        return genReplicationId(sourceDb, targetDb, opts3).then(
          function (replicationId3) {
            replicationId3.should.not.eql(replicationId2);

            return genReplicationId(sourceDb, targetDb, opts4).then(
              function (replicationId4) {
                replicationId4.should.eql(replicationId3);
                return replicationId4;
              }
            );
          }
        );
      }).then(function (replicationId4) {
        return genReplicationId(sourceDb, targetDb, opts5).then(
          function (replicationId5) {
            replicationId5.should.not.eql(replicationId4);

            return genReplicationId(sourceDb, targetDb, opts6).then(
              function (replicationId6) {
                replicationId6.should.not.eql(replicationId5);
              }
            );
          }
        );
      });
    }
  );
});
