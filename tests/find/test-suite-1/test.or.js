'use strict';

testCases.push(function (dbType, context) {
    describe(dbType + ': test.or.js', function () {

        beforeEach(function () {
            return context.db.bulkDocs([
                { name: 'Mario', _id: 'mario', rank: 5, series: 'Mario', debut: 1981, awesome: true },
                { name: 'Jigglypuff', _id: 'puff', rank: 8, series: 'Pokemon', debut: 1996,
                    awesome: false },
                { name: 'Link', rank: 10, _id: 'link', series: 'Zelda', debut: 1986, awesome: true },
                { name: 'Donkey Kong', rank: 7, _id: 'dk', series: 'Mario', debut: 1981, awesome: false },
                { name: 'Pikachu', series: 'Pokemon', _id: 'pikachu', rank: 1, debut: 1996, awesome: true },
                { name: 'Captain Falcon', _id: 'falcon', rank: 4, series: 'F-Zero', debut: 1990,
                    awesome: true },
                { name: 'Luigi', rank: 11, _id: 'luigi', series: 'Mario', debut: 1983, awesome: false },
                { name: 'Fox', _id: 'fox', rank: 3, series: 'Star Fox', debut: 1993, awesome: true },
                { name: 'Ness', rank: 9, _id: 'ness', series: 'Earthbound', debut: 1994, awesome: true },
                { name: 'Samus', rank: 12, _id: 'samus', series: 'Metroid', debut: 1986, awesome: true },
                { name: 'Yoshi', _id: 'yoshi', rank: 6, series: 'Mario', debut: 1990, awesome: true },
                { name: 'Kirby', _id: 'kirby', series: 'Kirby', rank: 2, debut: 1992, awesome: true },
                { name: 'Master Hand', _id: 'master_hand', series: 'Smash Bros', rank: 0, debut: 1999,
                    awesome: false }
            ]);
        });

        it('#6366 should do a basic $or', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        { "name": "Link" },
                        { "name": "Mario" }
                    ]
                }
            }).then(function (res) {
                var docs = res.docs.map(function (doc) {
                    return {
                        _id: doc._id
                    };
                });
                docs.should.deep.equal([
                    {'_id': 'link'},
                    {'_id': 'mario'},
                ]);
            });
        });

        it('#6366 should do a basic $or, with explicit $eq', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        { "name": {$eq: "Link"} },
                        { "name": {$eq: "Mario"} }
                    ]
                }
            }).then(function (res) {
                var docs = res.docs.map(function (doc) {
                    return {
                        _id: doc._id
                    };
                });
                docs.should.deep.equal([
                    {'_id': 'link'},
                    {'_id': 'mario'},
                ]);
            });
        });

        it('#7458 should do $or with nested $and', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        { "name": {$eq: "Link"} },
                        {
                            "$and": [
                                {"name": "Mario"},
                                {"rank": 5}
                            ]
                        }
                    ]
                }
            }).then(function (res) {
                var docs = res.docs.map(function (doc) {
                    return {
                        _id: doc._id
                    };
                });
                docs.should.deep.equal([
                    {'_id': 'link'},
                    {'_id': 'mario'},
                ]);
            });
        });

        it('#7458 should do $or with nested $and, with explicit $eq', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        { "name": {$eq: "Link"} },
                        {
                            "$and": [
                                {"name": {$eq: "Mario"}},
                                {"rank": {$eq: 5}}
                            ]
                        }
                    ]
                }
            }).then(function (res) {
                var docs = res.docs.map(function (doc) {
                    return {
                        _id: doc._id
                    };
                });
                docs.should.deep.equal([
                    {'_id': 'link'},
                    {'_id': 'mario'},
                ]);
            });
        });

    });
});
