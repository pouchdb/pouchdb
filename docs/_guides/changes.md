---
index: 12
layout: guide
title: Changes feed
sidebar: guides_nav.html
---

One of the brilliant things about CouchDB replication is that it makes it easy to learn about changes made to the database over time. CouchDB allows you to easily answer questions like:

* What changes occurred to the database since a given time?
* What changes occurred to this document? 
* What did this database look like a few days ago?

For all of these and related questions, there's the `changes()` API.

Basic changes usage
---------

If you want to simply fetch all changes since the beginning of time, you can do:

```js
db.changes({
  since: 0
}).then(function (changes) {
  
}).catch(function (err) {
  // handle errors
});
```

You can see a **[live example](http://bl.ocks.org/nolanlawson/7c32861af5d31a8fac4a)** of this code.

Then you will have a list of all changes made to the database, in the order that they were made.

One thing you will notice about the changes feed is that it actually omits non-leaf revisions to documents. For instance, in the live example, we skip from `seq` 1 immediately to `seq` 3.

This is by design &ndash; the changes feed only tells us about leaf revisions. However, the order of those leaf revisions is determined by the order they were put in the database. So you may notice that `'firstDoc'` still appears before `'secondDoc'`, which appears before `'thirdDoc'`.

Changes pagination
------

If you expect this to be a very large number of changess, you can also use the `limit` option to do pagination:

```js
var pageSize = 10;
var lastSeq = 0;
function fetchNextPage() {
  return db.changes({
    since: lastSeq,
    limit: pageSize
  }).then(function (changes) {
    if (changes.results.length < pageSize) {
      // done!
    } else {
      lastSeq = changes.last_seq;
      return fetchNextPage();
    }
  });
}

fetchNextPage().catch(function (err) {
  // handle errors
});
```

You can see a **[live example](http://bl.ocks.org/nolanlawson/dcdeae555b31c2a6d332)** of this code.

`seq` versus `_rev`
---------

The changes feed lists each change with a corresponding `seq` integer. `seq` always starts with 0, and beyond that it increases monotonically. (In Cloudant, these are strings rather than integers.)

`seq` can be thought of as a version number for the entire database. Basically it answers the question of "How many total changes have been made to all documents in this database?" This sets it apart from the revision hash `_rev`, which marks the changes made to a single document.

However, the `seq` between two databases is not guaranteed to be kept in sync. CouchDB and PouchDB have slightly different ways of increasing their `seq` values, so really `seq` is only meaningful within a single database.

Live changes feed
-------

Just like replication, you can also listen to a live changes feed. The way this works is very similar to the replication API:

```js
db.changes({
  since: 'now'
}).on('change', function (change) {
  // received a change
}).on('error', function (err) {
  // handle errors
});
```

In the above example, we've also taken advantage of the quasi-magical `'now'` option for `since`, which will give us all changes from the moment we start listening.

This can be very useful for scenarios where you want to update the UI whenever something in the database changes, such as for a real-time chat application.

Related API documentation
--------

* [changes()](/api.html#changes)

Next
-----

Now that we know how to hook our data spigot to the changes feed, let's look into using the very powerful `query()` API.
