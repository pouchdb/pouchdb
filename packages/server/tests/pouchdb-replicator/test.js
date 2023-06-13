const Promise = require('bluebird');
global.Promise = Promise; //use bluebird for all promises
const {PouchDB, setup, teardown, should} = require('../testutils');
const Replicator = require('../../packages/node_modules/pouchdb-replicator');
const extend = require('extend');

PouchDB.plugin(Replicator);

const replicationDocument = {
	"_id": "my_replication",
	"source": "a",
	"target": "b",
	"continuous": true
};

let db;

describe('replicator url helper', () => {
	const createSafeUrl = Replicator.createSafeUrl;

	it("handles string", () => {
		const db = "db-name";
		const out = createSafeUrl(db);
		out.should.equal(db);
	});

	it("handles name object", () => {
		const db = {
			name: "db-name"
		};

		const out = createSafeUrl(db);
		out.should.equal(db);
	});

	it("returns url without auth", () => {
		const source = {
			headers: {},
			url: 'http://dev:5984/animaldb-clone'
		};

		const out = createSafeUrl(source);
		out.should.equal(source.url);
	});

	it("returns url with auth", () => {
		const source = {
			headers: {
				Authorization: "Basic dGVzdGVyOnRlc3RlcnBhc3M="
			},
			url: 'http://dev:5984/animaldb-clone'
		};

		const out = createSafeUrl(source);
		out.should.equal('http://tester:testerpass@dev:5984/animaldb-clone');
	});

});

describe('async replicator tests', () => {
	beforeEach(() => {
		db = setup();
	});

	afterEach(teardown);

	it('basic', done => {
		db.startReplicator((err, res) => {
			if (err) { return done(err); }


			should.not.exist(res);
			db.stopReplicator((err, res) => {
				should.not.exist(res);
				done(err);
			});
		});
	});
});

describe('sync replicator tests', () => {
	beforeEach(() => {
		db = setup();

		return db.startReplicator().then((err, res) => {
			should.not.exist(res);
		});
	});

	afterEach(() => {
		return db.stopReplicator()
		.then((err, res) => {
			should.not.exist(res);
			return new PouchDB('a').destroy();
		}).then(() => {
			return new PouchDB('b').destroy();
		})
		.then(teardown);
	});

	it('basic', () => {
		// let beforeEach & afterEach do their job
	});

	it('start twice', () => {
		return db.startReplicator()
		.then(() => {
			throw "should not get here";
		}).catch(err => {
			err.status.should.equal(500);
			err.name.should.equal('already_active');
		});
	});

	it('stop twice', () => {
		// stop
		return db.stopReplicator().then(() => {
			return db.stopReplicator()
				.then(() => {
					throw "should not get here";
				}).catch(err => {
					err.toString().should.contain('500');
					err.toString().should.contain('already_inactive');
					return db.startReplicator();
				});
		});
	});

	function replicationCompletion(db, name) {
		return new Promise (resolve => {
			const check = (doc) => {
				if (doc._replication_state === 'completed') {
					resolve(doc);
					return true;
				}

				return async(resolve);
			};
			const async = () => db.get(name).then(check);

			async();
		});
	}

	it('replication validation', () => {
		return db.post({}).catch(err => {
			err.status.should.equal(403);
		});
	});

	it('simple replication', () => {
		const dbSource = new PouchDB('a');
		return dbSource.put({_id: 'test'})
			.then(() => {
				const repDoc = extend({}, replicationDocument);
				delete repDoc.continuous;
				return db.put(repDoc);
			})
			.then(resp => {
				resp.ok.should.be.ok;
				return replicationCompletion(db, 'my_replication');
			})
			.then(() => {
				// fails if the document isn't there.
				return new PouchDB('b').get('test');
			})
			.then (doc => {
				return doc.should.exist;
			})
			.catch(() => {
				throw "should not be here";
			});
	});

	it('change replication', () => {
		let dbC;

		return new PouchDB('a').put({_id: 'test'})
		.then (() => {
			const repDoc = extend({}, replicationDocument);
			delete repDoc.continuous;
			return db.put(repDoc);
		})
		.then(resp => {
			resp.ok.should.be.ok;
			return replicationCompletion(db, 'my_replication');
		})
		.then (doc => {
			doc.source = 'b';
			doc.target = 'c';
			delete doc._replication_state;
			return db.put(doc);
		})
		.then (resp2 => {
			resp2.ok.should.be.ok;
			return replicationCompletion(db, 'my_replication');
		})
		.then (() => {
			dbC = new PouchDB('c');
			return dbC.get('test');
		})
		.then (() => {
			return dbC.destroy();
		});

	});

	function replicationRunning(db, name) {
		return new Promise (resolve => {
			const check = (doc) => {
				if (doc._replication_id) {
					resolve(doc);
					return true;
				}

				return async();
			};
			const async = () => db.get(name).then(check);

			async();
		});
	}

	it('delete replication', () => {
		const dbA = new PouchDB('a');
		let dbB;
		return dbA.put({_id: 'test1'})
			.then(() => {
				return db.put(replicationDocument);
			})
			.then(resp => {
				resp.ok.should.be.ok;
				return replicationRunning(db, 'my_replication');
			})
			.then(doc => {
				return db.remove(doc);
			})
			.then(resp2 => {
				resp2.ok.should.be.ok;
				return dbA.put({_id: 'test2'});
			})
			.then(() => {
				dbB = new PouchDB('b');
				return dbB.get('test1');
			})
			.then(() => {
				return dbB.get('test2');
			})
			// .then(() => {
			// 	throw "should not get here";
			// })
			.catch(err => {
				err.status.should.equal(404);
			});

	});

	function replicationTriggered(db, name) {
		return new Promise (resolve => {
			const check = (doc) => {
				if (doc._replication_state === 'triggered') {
					resolve(doc);
					return true;
				}

				return async();
			};
			const async = () => db.get(name).then(check);

			async();
		});
	}

	it('double replication', () => {
		return db.put(replicationDocument)
		.then(resp => {
			resp.ok.should.be.ok;
			return replicationTriggered(db, 'my_replication');
		})
		.then(() => {
			const repDoc = extend({}, replicationDocument);
			repDoc._id = 'my_replication2';
			return db.put(repDoc);
		})
		.then(resp => {
			resp.ok.should.be.ok;
			return replicationRunning(db, 'my_replication');
		})
		.then(doc => {
			doc.should.have.property('_replication_state');
			return replicationRunning(db, 'my_replication2');
		})
		.then(doc => {
			doc.should.not.have.property('_replication_state');
		});
	});

	function replicationError(db, name) {
		return new Promise (resolve => {
			const check = (doc) => {
				if (doc._replication_state === 'error') {
					resolve(doc);
					return true;
				}

				return async();
			};
			const async = () => db.get(name).then(check);

			async();
		});
	}

	it('replication error', () => {
		const repDoc = extend({}, replicationDocument);
		// unlikely couchdb port
		repDoc.source = 'http://localhost:3423/test';
		// FIXME: https://github.com/pouchdb/pouchdb-replicator/issues/2
		repDoc.retry = false;

		return db.put(repDoc)
		.then(() => {
			return replicationError(db, 'my_replication');
		})
		.then(doc => {
			doc._replication_state.should.equal('error');
		});
	});
});
