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
  since: 0,
  include_docs: true
}).then(function (changes) {
  
}).catch(function (err) {
  // handle errors
});
```

You can see a **[live example](http://bl.ocks.org/nolanlawson/7c32861af5d31a8fac4a)** of this code.

Then you will have a list of all changes made to the database, in the order that they were made.

One thing you will notice about the changes feed is that it actually omits non-leaf revisions to documents. For instance, in the live example, we skip from `seq` 1 immediately to `seq` 3.

This is by design &ndash; the changes feed only tells us about leaf revisions. However, the order of those leaf revisions is determined by the order they were put in the database. So you may notice that `'firstDoc'` still appears before `'secondDoc'`, which appears before `'thirdDoc'`.

Also notice the the option `{include_docs: true}`. By default, the documents themselves are not included in the changes feed; only the `id`s, `rev`s, and whether or not they were `deleted`. With `{include_docs: true}`, however, each non-deleted change will have a `doc` property containing the new or modified document.

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

Understanding changes
---------

There are two types of changes:

* Added or modified documents
* Deleted documents

To distinguish between the two types in a live `changes()` listener,
you can use the following code:

```js
db.changes({
  since: 'now',
  live: true,
  include_docs: true
}).on('change', function (change) {
  // change.id contains the doc id, change.doc contains the doc
  if (change.deleted) {
    // document was deleted
  } else {
    // document was added/modified
  }
}).on('error', function (err) {
  // handle errors
});
```

You can see a [live example](http://bl.ocks.org/nolanlawson/fa42662cdfeeaa7b78fc) of this code.

Notice that `change.doc` contains the document (unless it's deleted), because we used `{include_docs: true}`.

Also notice that new documents always have revisions starting with the string `'1-'`. Subsequent revisions start with `'2-'`, `'3-'`, `'4-'`, etc.

{% include alert/start.html variant="info" %}

<p><strong>How can I distinguish between added and modified documents?</strong> Checking if the revision starts with <code>'1-'</code> is a pretty good trick. However, this will not work for databases that are replication targets, because replication only sends the latest versions of documents. This means that the <code>'1-'</code> revision may get skipped entirely, and the local database will only receive the 2nd, 3rd or 4th (etc.) revision. Conflicting revisions will also appear in the changes feed.</p>

<p>So the short answer is that you cannot. If you are trying to mirror changes in a non-Pouch structure (e.g. a list of DOM elements), then the best solution is to search all the DOM elements to see if the document already exists, or to re-run <code>allDocs()</code> for every change.</p>

{% include alert/end.html %}


Related API documentation
--------

* [changes()](/api.html#changes)

Next
-----

Now that we know how to hook our data spigot to the changes feed, let's look into using the very powerful `query()` API.
