---
layout: post

title: The Pains Of Being Async At Heart

author: Dale Harvey

---

If you are testing JavaScript you will likely have to test against async API's. These bring up some issues that you may not be familiar with if you are used to testing synchronous code. Here are a few things I have learnt working on the PouchDB test suite.

### Always wait for operations to complete before testing their result

This is the 101 of testing async code but it is the foundation for almost every other problem:

```js
db.put({_id: 'doc', foo: 'bar'});
db.get('doc').then(function(doc) {
  assert.equal(doc.foo, 'bar');
});
```

While this test may pass (although unlikely) it relies on a broken assumption that the write behind `.put` completes before the read behind `.get`. The proper way to test this is to wait until the `.put` is complete:

```js
db.put({_id: 'doc', foo: 'bar'}).then(function() {
  return db.get('doc');
}).then(function(doc) {
  assert.equal(doc.foo, 'bar');
});
```

As a side note [Promises](http://www.html5rocks.com/en/tutorials/es6/promises/) are huge improvement over callbacks for testing async code which by nature often involves a long sequential series of steps.

### `setTimeout` is almost always evil

```js
// Test that a local write gets synced to remote database
localDB.sync(remoteDB, {live: true});
localDB.put({_id: 'doc', foo: 'bar'}).then(function() {
  setTimeout(function() {
    remoteDB.get('doc').then(function(doc) {
      assert.equal(doc.foo, 'bar');
    });
  }, 1000);
});
```

The main issue with `setTimeout` is that nothing is guaranteed to complete before the `setTimeout` finishes. While testing locally 1000ms may be more than enough time for the sync to do its magic if you start testing against non local database with increased latency that 1000ms will often be too short for the test to pass. The correct way to test this would be to listen for an event or to poll for the value:

```js
var changes = remoteDB.changes({live: true, include_docs: true});
changes.on('change', function(change) {
  assert.equal(change.doc.foo, 'bar');
  done();
});

localDB.sync(remoteDB, {live: true});
localDB.put({_id: 'doc', foo: 'bar'});
```

The added benefit to this is that your test will complete as soon as possible instead of waiting the full 1000ms on every run.

### I said "almost"

I have found one use case where `setTimeout` is useful and that is to "prove a negative". This is a test that will pass if the `setTimeout` ran immediately, for example:

```js
// Test we only receive one change event for a write
var numChanges = 0;
var changes = db.changes({live: true, include_docs: true});
changes.on('change', function(change) {
  numChanges++;
  setTimeout(function() {
    assert.equal(numChanges, 1);
    done();
  }, 500);
});
```

Try going through your tests and change any `setTimeout` to `setTimeout(fun, 0);`. If your test fails then it is likely broken.

### You should ensure your test is really really finished

This has been a very tricky issue in PouchDB. You want to make sure that when you call `done()` on a test that you are absolutely finished with any processing otherwise your test may effect follow on tests, to take the previous example:

```js
var changes = db.changes({live: true, include_docs: true});
changes.on('change', function(change) {
  assert.equal(change.doc.foo, 'bar');
  changes.cancel();
  done();
});

db.put({_id: 'doc', foo: 'bar'});
```

This test looks fine however inside `changes.cancel()` we may be doing some processing that happens asynchronously, specifically we may be aborting a HTTP request that we haven't processed the reply of yet and as we process the reply the next test may have started. This type of issue is extremely problematic as it can lead to unexpected behavour in tests that are not the cause of the problem.

In PouchDB we fix this with:

```js
var changes = db.changes({live: true, include_docs: true});
changes.on('change', function(change) {
  assert.equal(change.doc.foo, 'bar');
  changes.cancel();
});
changes.on('complete', done);

db.put({_id: 'doc', foo: 'bar'});
```

The `complete` event is fired when we are sure we have dealt with all the processing involved in that changes event listener and so we know the test is completed any processing when we call `done()`.

There are lots of issues when testing JavaScript but this hits on a few of the main issues we have had in PouchDB. I hope its helpful and would love to hear some issues you may have had with it.
