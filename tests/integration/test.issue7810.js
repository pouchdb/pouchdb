describe('#7810 query will not find documents when an index is used', function () {
    beforeEach(function () {
       return new PouchDB('mydb').destroy().then(function () {
            return new PouchDB('mydb', { db: require('memdown') }).destroy();
        });
    });
    it('should find the documents even if a index is used', function () {
        PouchDB.plugin(require('pouchdb-find'));
        var CustomPouch = PouchDB.defaults({db: require('memdown')});
        var db = new CustomPouch('mydb');
        return db.createIndex({
            index: {
                fields: [
                    'passportId'
                ]
            }
        }).then(function () {
            return db.put({
                _id: 'foobar',
                passportId: 'z3i7q29g4yr1',
                firstName: 'Edison',
                lastName: 'Keebler',
                age: 24
            });
        }).then(function () {
            return db.find({
                selector: {
                    _id: {}
                },
                limit: 1
            });
        }).then(function (docs) {
            // console.log(JSON.stringify(docs, null, 2));
            if (docs.docs.length !== 1) {
                throw new Error('document not found');
            }
        });
    });
});