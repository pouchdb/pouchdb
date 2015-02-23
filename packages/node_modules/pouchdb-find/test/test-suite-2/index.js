'use strict';

var Promise = require('../test-utils').Promise;

module.exports = function (dbName, dbType, Pouch) {
  describe(dbType + ' test suite 2', function () {
    // tests that don't destroy/recreate the database for each test,
    // because that makes them take a long time

    this.timeout(100000);

    var context = {};

    before(function () {
      this.timeout(60000);
      context.db = new Pouch(dbName);

      return context.db.bulkDocs([
        { name: 'mario', _id: 'mario', rank: 5, series: 'mario', debut: 1981 },
        { name: 'jigglypuff', _id: 'puff', rank: 8, series: 'pokemon', debut: 1996 },
        { name: 'link', rank: 10, _id: 'link', series: 'zelda', debut: 1986 },
        { name: 'donkey kong', rank: 7, _id: 'dk', series: 'mario', debut: 1981 },
        { name: 'pikachu', series: 'pokemon', _id: 'pikachu', rank: 1, debut: 1996 },
        { name: 'captain falcon', _id: 'falcon', rank: 4, series: 'f-zero', debut: 1990 },
        { name: 'luigi', rank: 11, _id: 'luigi', series: 'mario', debut: 1983 },
        { name: 'fox', _id: 'fox', rank: 3, series: 'star fox', debut: 1993 },
        { name: 'ness', rank: 9, _id: 'ness', series: 'earthbound', debut: 1994 },
        { name: 'samus', rank: 12, _id: 'samus', series: 'metroid', debut: 1986 },
        { name: 'yoshi', _id: 'yoshi', rank: 6, series: 'mario', debut: 1990 },
        { name: 'kirby', _id: 'kirby', series: 'kirby', rank: 2, debut: 1992 }
      ]).then(function () {
        return Promise.all([
          context.db.createIndex({index: {fields: ['rank']}}),
          context.db.createIndex({index: {fields: ['series']}}),
          context.db.createIndex({index: {fields: ['debut']}}),
          context.db.createIndex({index: {fields: ['name']}}),
          context.db.createIndex({index: {fields: ['name', 'rank']}}),
          context.db.createIndex({index: {fields: ['name', 'series']}}),
          context.db.createIndex({index: {fields: ['series', 'debut', 'rank']}}),
          context.db.createIndex({index: {fields: ['rank', 'debut']}})
        ]);
      });
    });
    after(function () {
      this.timeout(60000);
      return context.db.destroy();
    });

    require('./test.kitchen-sink')(dbType, context);
    require('./test.kitchen-sink-2')(dbType, context);
  });
};