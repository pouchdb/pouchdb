'use strict';

testCases.push(function (dbType, context) {
    describe(dbType + ': test.or.complex.js', function () {

        beforeEach(function () {
            return context.db.bulkDocs([
                {
                    _id: 'mario',
                    name: 'Mario',
                    rank: 5,
                    series: 'Mario',
                    debut: 1981,
                    awesome: true,
                    colors: [
                        {name: 'red', source: 'clothes'},
                        {name: 'brown', source: 'hair'}
                    ],
                    metadata: {
                        active: true,
                        good: true,
                        friends: [
                            {id: 'luigi', level: 'very good'},
                            {id: 'kirby', level: 'good'}
                        ],
                    },
                    attacks: [
                        {name: 'fireball', power: 'very strong', speed: 'slow'},
                        {name: 'punch', power: 'strong', speed: 'normal'},
                        {name: 'jump', power: 'weak', speed: 'fast'}
                    ]
                },
                {
                    _id: 'puff',
                    name: 'Jigglypuff',
                    rank: 8,
                    series: 'Pokemon',
                    debut: 1996,
                    awesome: false,
                    colors: [
                        {name: 'pink', source: 'body'},
                    ],
                    metadata: {
                        active: true,
                        good: false,
                        friends: [
                            {id: 'pikachu', level: 'good'},
                            {id: 'master_hand', level: 'good'}
                        ],
                    },
                    attacks: [
                        {name: 'sing', power: 'very strong', speed: 'slow'},
                        {name: 'punch', power: 'weak', speed: 'fast'},
                    ]
                },
                {
                    _id: 'link',
                    name: 'Link',
                    rank: 10,
                    series: 'Zelda',
                    debut: 1986,
                    awesome: true,
                    colors: [
                        {name: 'green', source: 'clothes'},
                        {name: 'yellow', source: 'hair'}
                    ],
                    metadata: {
                        active: true,
                        good: true,
                        friends: [
                            {id: 'samus', level: 'very good'},
                            {id: 'dk', level: 'ok '}
                        ]
                    },
                    attacks: [
                        {name: 'sword', power: 'strong', speed: 'fast'},
                        {name: 'shield', power: 'weak', speed: 'fast'},
                        {name: 'punch', power: 'normal', speed: 'fast'}
                    ]
                },
                {
                    name: 'Donkey Kong',
                    rank: 7,
                    _id: 'dk',
                    series: 'Mario',
                    debut: 1981,
                    awesome: false,
                    colors: [
                        {name: 'red', source: 'clothes'},
                        {name: 'brown', source: 'hair'}
                    ],
                    metadata: {
                        active: true,
                        good: false,
                        friends: [
                            {id: 'fox', level: 'very good'},
                            {id: 'yoshi', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'barrel', power: 'very strong', speed: 'slow'},
                        {name: 'punch', power: 'very strong', speed: 'slow'},
                    ]
                },
                {
                    name: 'Pikachu',
                    series: 'Pokemon',
                    _id: 'pikachu',
                    rank: 1,
                    debut: 1996,
                    awesome: true,
                    colors: [
                        {name: 'yellow', source: 'body'}
                    ],
                    metadata: {
                        active: true,
                        good: true,
                        friends: [
                            {id: 'samus', level: 'good'},
                            {id: 'puff', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'headbutt', power: 'weak', speed: 'fast'},
                        {name: 'shock', power: 'very strong', speed: 'very slow'},
                        {name: 'irontail', power: 'normal', speed: 'normal'}
                    ]
                },
                {
                    name: 'Captain Falcon',
                    _id: 'falcon',
                    rank: 4,
                    series: 'F-Zero',
                    debut: 1990,
                    awesome: true,
                    colors: [
                        {name: 'blue', source: 'clothes'},
                        {name: 'red', source: 'helmet'}
                    ],
                    metadata: {
                        active: true,
                        good: true,
                        friends: [
                            {id: 'ness', level: 'good'},
                            {id: 'master_hand', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'falcon_punch', power: 'very strong', speed: 'slow'},
                        {name: 'punch', power: 'normal', speed: 'normal'},
                        {name: 'kick', power: 'normal', speed: 'normal'}
                    ]
                },
                {
                    name: 'Luigi',
                    rank: 11,
                    _id: 'luigi',
                    series: 'Mario',
                    debut: 1983,
                    awesome: false,
                    colors: [
                        {name: 'green', source: 'clothes'},
                        {name: 'brown', source: 'hair'}
                    ],
                    metadata: {
                        active: true,
                        good: true,
                        friends: [
                            {id: 'mario', level: 'very good'},
                            {id: 'yoshi', level: 'very good'}
                        ]
                    },
                    attacks: [
                        {name: 'ghostbuster', power: 'strong', speed: 'normal'},
                        {name: 'punch', power: 'normal', speed: 'fast'},
                        {name: 'jump', power: 'normal', speed: 'fast'}
                    ]
                },
                {
                    name: 'Fox',
                    _id: 'fox',
                    rank: 3,
                    series: 'Star Fox',
                    debut: 1993,
                    awesome: true,
                    colors: [
                        {name: 'white', source: 'clothes'},
                        {name: 'brown', source: 'hair'}
                    ],
                    metadata: {
                        active: false,
                        good: true,
                        friends: [
                            {id: 'dk', level: 'very good'},
                            {id: 'kirby', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'barrel_roll', power: 'very strong', speed: 'slow'},
                        {name: 'kick', power: 'normal', speed: 'normal'},
                        {name: 'punch', power: 'normal', speed: 'normal'}
                    ]
                },
                {
                    name: 'Ness',
                    rank: 9,
                    _id: 'ness',
                    series: 'Earthbound',
                    debut: 1994,
                    awesome: true,
                    colors: [
                        {name: 'red', source: 'cap'},
                        {name: 'blue', source: 'clothes'},
                        {name: 'yellow', source: 'clothes'}
                    ],
                    metadata: {
                        active: undefined,
                        good: true,
                        friends: [
                            {id: 'falcon', level: 'good'},
                            {id: 'master_hand', level: 'very good'}
                        ]
                    },
                    attacks: [
                        {name: 'hammer', power: 'very strong', speed: 'slow'},
                        {name: 'bat', power: 'very strong', speed: 'slow'},
                        {name: 'kameha', power: 'very strong', speed: 'slow'}
                    ]
                },
                {
                    name: 'Samus',
                    rank: 12,
                    _id: 'samus',
                    series: 'Metroid',
                    debut: 1986,
                    awesome: true,
                    colors: [
                        {name: 'blue', source: 'clothes'},
                        {name: 'yellow', source: 'hair'}
                    ],
                    metadata: {
                        active: true,
                        good: true,
                        friends: [
                            {id: 'link', level: 'very good'},
                            {id: 'kirby', level: 'very good'}
                        ]
                    },
                    attacks: [
                        {name: 'laser', power: 'very strong', speed: 'slow'},
                        {name: 'fast_bullet', power: 'strong', speed: 'normal'},
                        {name: 'kick', power: 'strong', speed: 'fast'}
                    ]
                },
                {
                    name: 'Yoshi',
                    _id: 'yoshi',
                    rank: 6,
                    series: 'Mario',
                    debut: 1990,
                    awesome: true,
                    colors: [
                        {name: 'green', source: 'body'}
                    ],
                    metadata: {
                        active: undefined,
                        good: true,
                        friends: [
                            {id: 'luigi', level: 'very good'},
                            {id: 'dk', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'tongue_attack', power: 'strong', speed: 'fast'},
                        {name: 'egging', power: 'strong', speed: 'fast'},
                        {name: 'bite', power: 'strong', speed: 'fast'}
                    ]
                },
                {
                    name: 'Kirby',
                    _id: 'kirby',
                    series: 'Kirby',
                    rank: 2,
                    debut: 1992,
                    awesome: true,
                    colors: [
                        {name: 'pink', source: 'body'},
                    ],
                    metadata: {
                        active: true,
                        good: false,
                        friends: [
                            {id: 'samus', level: 'very good'},
                            {id: 'mario', level: 'good'},
                            {id: 'fox', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'blackhole', power: 'very strong', speed: 'fast'},
                        {name: 'punch', power: 'normal', speed: 'very fast'},
                        {name: 'kick', power: 'normal', speed: 'very fast'}
                    ]
                },
                {
                    name: 'Master Hand',
                    _id: 'master_hand',
                    series: 'Smash Bros',
                    rank: 0,
                    debut: 1999,
                    awesome: false,
                    colors: [
                        {name: 'white', source: 'clothes'},
                    ],
                    metadata: {
                        active: true,
                        good: false,
                        friends: [
                            {id: 'ness', level: 'very good'},
                            {id: 'puff', level: 'good'},
                            {id: 'falcon', level: 'good'}
                        ]
                    },
                    attacks: [
                        {name: 'grab', power: 'very strong', speed: 'fast'},
                        {name: 'rip', power: 'very strong', speed: 'fast'},
                        {name: 'tear', power: 'very strong', speed: 'fast'}
                    ]
                }
            ]);
        });

        it('#XXXX should do a $or on undefined with $ne', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"metadata.active": {$ne: false}},
                        {"awesome": false}
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'dk'},
                    {'_id': 'luigi'},
                    {'_id': 'master_hand'},
                    {'_id': 'ness'},
                    {'_id': 'puff'},
                    {'_id': 'yoshi'},
                ]);
            });
        });

        it('#XXXX should do a $or on undefined with $nin', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"metadata.active": {$nin: false}},
                        {"awesome": false}
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'dk'},
                    {'_id': 'luigi'},
                    {'_id': 'master_hand'},
                    {'_id': 'ness'},
                    {'_id': 'puff'},
                    {'_id': 'yoshi'},
                ]);
            });
        });

        it('#XXXX should do a $or, with nested $elemMatch', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"metadata.friends": {$elemMatch: {id: 'samus'}}},
                        {"colors": {$elemMatch: {name: 'white'}}}
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'fox'},
                    {'_id': 'kirby'},
                    {'_id': 'link'},
                    {'_id': 'master_hand'},
                    {'_id': 'pikachu'},
                ]);
            });
        });

        it('#XXXX should handle $or with single argument', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"awesome": false},
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'dk'},
                    {'_id': 'luigi'},
                    {'_id': 'master_hand'},
                    {'_id': 'puff'},
                ]);
            });
        });

        it('#XXXX should handle $or with single nested argument on undefined', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"metadata.active": {$eq: "false"}},
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'fox'},
                ]);
            });
        });

        it('#XXXX should handle $or with single nested argument on undefined', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"metadata.active": {$eq: "false"}},
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'fox'},
                ]);
            });
        });

        it('#XXXX should handle $or with single nested argument', function () {
            var db = context.db;
            return db.find({
                selector: {
                    "$or": [
                        {"metadata.good": {$eq: "false"}},
                    ]
                }
            }).then(function (res) {
                getIdArray(res).should.deep.equal([
                    {'_id': 'dk'},
                    {'_id': 'kirby'},
                    {'_id': 'master_hand'},
                    {'_id': 'puff'},
                ]);
            });
        });

        function getIdArray(res) {
            return res.docs.map(function (doc) {
                return {
                    _id: doc._id
                };
            });
        }
    });
});
