'use strict';

var adapters = ['local', 'http'];

/**
 * Test to reproduce issue #7841
 * 'deletion does not work when using bulkDocs with new_edits=false'
 * @link https://github.com/pouchdb/pouchdb/issues/7841
 */
adapters.forEach(function (adapter) {
    describe('test.issue7841.js- ' + adapter, function () {
        var dbs = {};

        beforeEach(function () {
            dbs.name = testUtils.adapterUrl(adapter, 'testdb');
        });

        afterEach(function (done) {
            testUtils.cleanup([dbs.name], done);
        });

        it('Should not find the deleted document via allDocs()', function () {
            var db = new PouchDB(dbs.name);

            var _id = 'alice';
            /**
             * First insert the document with a normal put()
             */
            return db.put({
                _id,
                age: 42
            }).then(function () {
                /**
                 * Then delete the document via bulkDocs()
                 * with new_edits=false
                 */
                return db.bulkDocs(
                    [
                        {
                            _id,
                            _deleted: true,
                            _rev: '2-22080c42d471e3d2625e49dcca3b8e2b'
                        }
                    ],
                    {
                        new_edits: false
                    }
                );
            }).then(function () {
                return db.allDocs();
            }).then(function (docsAfterDelete) {
                should.equal(docsAfterDelete.rows.length, 0, 'allDocs() after delete');
            });
        });
    });
});
