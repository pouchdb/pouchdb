describe('#7810 query will not find documents when an index is used', function () {
    var dbNameWithIndex = 'db_with_index';
    var dbNameWithoutIndex = 'db_without_index';
    beforeEach(function () {
        return Promise.all(
            [dbNameWithIndex, dbNameWithoutIndex].map(function (dbName) {
                return new PouchDB(dbName).destroy().then(function () {
                    return new PouchDB(dbName, { db: require('memdown') }).destroy();
                });
            })
        );
    });
    it('should find the same documents even if a index exists', function () {
        PouchDB.plugin(require('../../packages/node_modules/pouchdb-find'));
        var CustomPouch = PouchDB.defaults({ db: require('memdown') });

        // create two databases
        var dbWithIndex = new CustomPouch(dbNameWithIndex);
        var dbWithoutIndex = new CustomPouch(dbNameWithoutIndex);

        // add any index to one of the databases
        return dbWithIndex.createIndex({
            index: {
                fields: [
                    'passportId'
                ]
            }
        }).then(function () {
            // add the same document to both databases
            var docData = {
                _id: 'foobar',
                passportId: 'z3i7q29g4yr1',
                firstName: 'Edison',
                lastName: 'Keebler',
                age: 24
            };
            return Promise.all([
                dbWithIndex.put(docData),
                dbWithoutIndex.put(docData)
            ]);
        }).then(function () {
            // run the same query on both databases
            var query = {
                selector: {
                    _id: {}
                },
                limit: 1
            };
            return Promise.all([
                dbWithIndex.find(query),
                dbWithoutIndex.find(query)
            ]);
        }).then(function (results) {
            // both databases should have returned the same results
            var resultWithIndex = results[0];
            var resultWithoutIndex = results[1];

            if (resultWithIndex.docs.length !== resultWithoutIndex.docs.length) {
                console.log(JSON.stringify(results, null, 2));
                throw new Error('results are not equal');
            }
        });
    });
});