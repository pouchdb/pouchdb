'use strict';

describe('test.active_tasks.js', function () {

  afterEach(function (done) {
    PouchDB.activeTasks.tasks = new Map();
    return done();
  });

  it('Throws when task type is wrong', function () {
    try {
      const task = {database: 'test', total_changes: 12};
      PouchDB.activeTasks.add(task);
    } catch (err) {
      should.exist(err);
      err.should.be.instanceof(Error);
    }
    try {
      const task = {type: 'undefined', database: 'test', total_changes: 12};
      PouchDB.activeTasks.add(task);
    } catch (err) {
      should.exist(err);
      err.should.be.instanceof(Error);
    }
  });

  it('Throws when task database is not a string', function () {
    try {
      const task = {type: 'database_compaction', total_changes: 12};
      PouchDB.activeTasks.add(task);
    } catch (err) {
      should.exist(err);
      err.should.be.instanceof(Error);
    }

    try {
      const task = {type: 'database_compaction', database: 55, total_changes: 12};
      PouchDB.activeTasks.add(task);
    } catch (err) {
      should.exist(err);
      err.should.be.instanceof(Error);
    }
  });

  it('Throws when task total_changes is not a number', function () {
    try {
      const task = {type: 'database_compaction', database: "test"};
      PouchDB.activeTasks.add(task);
    } catch (err) {
      should.exist(err);
      err.should.be.instanceof(Error);
    }

    try {
      const task = {type: 'database_compaction', database: "test", total_changes: null};
      PouchDB.activeTasks.add(task);
    } catch (err) {
      should.exist(err);
      err.should.be.instanceof(Error);
    }
  });

  it('Can add a task', function () {
    const task1 = {type: 'database_compaction', database: 'test', total_changes: 12};
    const id1 = PouchDB.activeTasks.add(task1);
    assert.typeOf(id1, 'symbol');
  });

  it('Can get tasks by id', function () {
    const task2 = {type: 'database_compaction', database: 'test', total_changes: 546};
    const id2 = PouchDB.activeTasks.add(task2);
    const got2 = PouchDB.activeTasks.get(id2);
    assert.equal(got2['pid'], id2);
  });

  it('Can get all tasks', function () {
    const task1 = {type: 'database_compaction', database: 'test', total_changes: 12};
    const task2 = {type: 'database_compaction', database: 'test', total_changes: 546};
    const id1 = PouchDB.activeTasks.add(task1);
    const id2 = PouchDB.activeTasks.add(task2);
    PouchDB.activeTasks.update(id1, {"changes_done": 2});
    PouchDB.activeTasks.update(id2, {"changes_done": 213});
    const tasks = PouchDB.activeTasks.list();
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].pid, id1);
    assert.equal(tasks[1].pid, id2);
  });

  it('Can get task progress', function () {
    const task = {type: 'database_compaction', database: 'test', total_changes: 2, changes_done: 1};
    const id = PouchDB.activeTasks.add(task);
    const got = PouchDB.activeTasks.get(id);
    assert.equal(got.progress, 50);
  });

  it('Can update a task', function () {
    const task1 = {type: 'database_compaction', database: 'test', total_changes: 12};
    const task2 = {type: 'database_compaction', database: 'test', total_changes: 546};
    const id1 = PouchDB.activeTasks.add(task1);
    const id2 = PouchDB.activeTasks.add(task2);
    PouchDB.activeTasks.update(id1, {"changes_done": 2});
    PouchDB.activeTasks.update(id2, {"changes_done": 213});
    const got1 = PouchDB.activeTasks.get(id1);
    const got2 = PouchDB.activeTasks.get(id2);
    got1['changes_done'].should.equal(2);
    got2['changes_done'].should.equal(213);
    got2['updated_on'].should.be.a('number');
  });

  it('Can remove a task', function () {
    const task1 = {type: 'database_compaction', database: 'test', total_changes: 12};
    const task2 = {type: 'database_compaction', database: 'test', total_changes: 546};
    const id1 = PouchDB.activeTasks.add(task1);
    const id2 = PouchDB.activeTasks.add(task2);
    PouchDB.activeTasks.update(id1, {"changes_done": 2});
    PouchDB.activeTasks.update(id2, {"changes_done": 213});
    PouchDB.activeTasks.remove(id1);
    const got2 = PouchDB.activeTasks.get(id2);
    PouchDB.activeTasks.tasks.size.should.equal(1);
    assert.equal(got2.pid, id2);
  });

});
