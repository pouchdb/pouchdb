'use strict';

testCases.push(function (dbType, context) {
	describe(dbType + ': test.or.complex.js', function () {

		beforeEach(function () {
			return context.db.bulkDocs([
				{
					_id: 'mario',
					name: 'Mario',
					awesome: true,
					metadata: {
						active: true,
						good: true,
						friends: [
							{ id: 'luigi', level: 'very good' },
						],
					},
				},
				{
					name: 'Donkey Kong',
					_id: 'dk',
					awesome: false,
					metadata: {
						active: true,
						good: false,
						friends: [
							{ id: 'fox', level: 'very good' },
						]
					},
				},
				{
					name: 'Captain Falcon',
					_id: 'falcon',
					awesome: true,
					metadata: {
						active: true,
						good: true,
						friends: [
							{ id: 'ness', level: 'good' },
						]
					},
				},
				{
					name: 'Luigi',
					_id: 'luigi',
					awesome: false,
					metadata: {
						active: true,
						good: true,
						friends: [
							{ id: 'mario', level: 'very good' },
						]
					},
				},
				{
					name: 'Fox',
					_id: 'fox',
					awesome: true,
					metadata: {
						active: false,
						good: true,
						friends: [
							{ id: 'dk', level: 'very good' },
						]
					},
				},
				{
					name: 'Samus',
					_id: 'samus',
					awesome: true,
					metadata: {
						active: true,
						good: true,
						friends: [
							{ id: 'link', level: 'very good' },
						]
					},
				},
				{
					name: 'Kirby',
					_id: 'kirby',
					awesome: true,
					metadata: {
						active: true,
						good: false,
						friends: [
							{ id: 'samus', level: 'very good' },
						]
					},
				},
			]);
		});

		it('#7872 should do a $or on undefined with $ne', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": [
						{ "metadata.active": { $ne: false } },
						{ "awesome": false }
					]
				}
			}).then(function (res) {
				getIdArray(res).should.deep.equal([
					{ '_id': 'dk' },
					{ '_id': 'luigi' },
				]);
			});
		});

		it('#7872 should do a $or on undefined with $nin', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": [
						{ "metadata.active": { $nin: false } },
						{ "awesome": false }
					]
				}
			}).then(function (res) {
				getIdArray(res).should.deep.equal([
					{ '_id': 'dk' },
					{ '_id': 'luigi' },
				]);
			});
		});

		it('#7872 should do a $or, with nested $elemMatch', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": [
						{ "metadata.friends": { $elemMatch: { id: 'samus' } } },
						{ "colors": { $elemMatch: { name: 'white' } } }
					]
				}
			}).then(function (res) {
				getIdArray(res).should.deep.equal([
					{ '_id': 'fox' },
					{ '_id': 'kirby' },
				]);
			});
		});

		it('#7872 should handle $or with single argument', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": [
						{ "awesome": false },
					]
				}
			}).then(function (res) {
				getIdArray(res).should.deep.equal([
					{ '_id': 'dk' },
					{ '_id': 'luigi' },
				]);
			});
		});

		it('#7872 should handle $or with single nested argument on undefined', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": [
						{ "metadata.active": { $eq: "false" } },
					]
				}
			}).then(function (res) {
				getIdArray(res).should.deep.equal([
					{ '_id': 'fox' },
				]);
			});
		});

		it('#7872 should handle $or with single nested argument', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": [
						{ "metadata.good": { $eq: "false" } },
					]
				}
			}).then(function (res) {
				getIdArray(res).should.deep.equal([
					{ '_id': 'dk' },
					{ '_id': 'kirby' },
				]);
			});
		});

		it('#7872 should return everything for empty $or', function () {
			var db = context.db;
			return db.find({
				selector: {
					"$or": []
				}
			}).then(function (res) {
				getIdArray(res).should.have.lengthOf(12);
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
