'use strict';

describe('test.active_tasks.js', function () {

  afterEach(function (done) {
    PouchDB.activeTasks.tasks = {};
    return done();
  });

  it('Can add a task', function () {
    const task1 = {name: 'lol', total_items: 12};
    const id1 = PouchDB.activeTasks.add(task1);
    id1.should.be.a('string');
  });

  it('Can get tasks by id', function () {
    const task2 = {name: 'wat', total_items: 546};
    const id2 = PouchDB.activeTasks.add(task2);
    const got2 = PouchDB.activeTasks.get(id2);
    got2['id'].should.equal(id2);
  });

  it('Can get all tasks', function () {
    const task1 = {name: 'lol', total_items: 12};
    const task2 = {name: 'wat', total_items: 546};
    const id1 = PouchDB.activeTasks.add(task1);
    const id2 = PouchDB.activeTasks.add(task2);
    PouchDB.activeTasks.update(id1, {"completed_items": 2});
    PouchDB.activeTasks.update(id2, {"completed_items": 213});
    const tasks = PouchDB.activeTasks.list();
    tasks.length.should.equal(2);
    tasks[0].id.should.equal(id1);
    tasks[1].id.should.equal(id2);
  });

  it('Can update a task', function () {
    const task1 = {name: 'lol', total_items: 12};
    const task2 = {name: 'wat', total_items: 546};
    const id1 = PouchDB.activeTasks.add(task1);
    const id2 = PouchDB.activeTasks.add(task2);
    PouchDB.activeTasks.update(id1, {"completed_items": 2});
    PouchDB.activeTasks.update(id2, {"completed_items": 213});
    const got1 = PouchDB.activeTasks.get(id1);
    const got2 = PouchDB.activeTasks.get(id2);
    got1['completed_items'].should.equal(2);
    got2['completed_items'].should.equal(213);
    got2['updated_at'].should.be.a('string');
  });

  it('Can remove a task', function () {
    const task1 = {name: 'lol', total_items: 12};
    const task2 = {name: 'wat', total_items: 546};
    const id1 = PouchDB.activeTasks.add(task1);
    const id2 = PouchDB.activeTasks.add(task2);
    PouchDB.activeTasks.update(id1, {"completed_items": 2});
    PouchDB.activeTasks.update(id2, {"completed_items": 213});
    PouchDB.activeTasks.remove(id1);
    const got2 = PouchDB.activeTasks.get(id2);
    Object.keys(PouchDB.activeTasks.tasks).length.should.equal(1);
    got2['id'].should.equal(id2);
  });

});
