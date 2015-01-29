---
index: 10
layout: guide
title: Replication
sidebar: guides_nav.html
---

PouchDB and CouchDB were designed for one main purpose: **sync**. Jason Smith has [a great quote](http://nodeup.com/thirtyseven) about this:

> The way I like to think about CouchDB is this: CouchDB is bad at everything, *except syncing*. And it turns out that's the most important feature you could ever ask for, for many types of software."

When you first start using CouchDB, you may become frustrated because it doesn't work quite like other databases. Unlike most databases, CouchDB requires you to manage revisions (`_rev`), which can be tedious.

However, CouchDB was designed with sync in mind, and this is exactly what it excels at. Many of the rough edges of the API serve this larger purpose. For instance, managing your document revisions pays off in the future, when you eventually need to start dealing with conflicts.

CouchDB sync
------

CouchDB sync has a unique design. Rather than relying on a master/slave architecture, CouchDB
supports a **multi-master** architecture. You can think of this as a system where any node can be written to or read from, and where you don't have to care which one is the "master" and which one is the "slave." In CouchDB's egalitarian world, every citizen is as worthy as another.

{% include img.html src="offline_replication.gif" alt="Offline replication with CouchDB. Thanks to IBM for the image: http://www.ibm.com/developerworks/library/wa-couchdb/" %}

When you use PouchDB, CouchDB, and other members of the Couch family, you
don't have to worry which database is the "single source of truth." They all are. According to the CAP theorem, CouchDB is an AP database, meaning that it's **P**artitioned, 
every node is **A**vailable, and it's only eventually **C**onsistent.

To illustrate, imagine a multi-node architecture with CouchDB servers spread across several continents. As long as you're willing to wait, the data will eventually flow 
from Australia to Europe to North America to wherever. Users around the world running PouchDB in their browsers or [Couchbase Lite](https://github.com/couchbase/couchbase-lite-ios)/[Cloudant Sync](https://github.com/cloudant/CDTDatastore) in their smartphones experience the 
same privileges. The data won't show up instantaneously, but depending on the Internet connection speed, it's usually close enough to real-time.

In cases of conflict, CouchDB will choose an arbitrary winner that every node can agree upon deterministically. However, conflicts are still stored in the **revision tree** (similar to a Git history tree), which means that app developers can either surface the conflicts to the user, or just ignore them.

In this way, CouchDB replication "just works."

Setting up sync
-----------

As you already know, you can create either local PouchDBs:

```js
var localDB = new PouchDB('mylocaldb')
```

or remote PouchDBs:

```js
var remoteDB = new PouchDB('http://localhost:5984/myremotedb')
```

This pattern comes in handy when you want to share data between the two.

The simplest case is **unidirectional replication**, meaning you just want one database to mirror its changes to a second one. Writes to the second database, however, will not propagate back to the master database.

To perform unidirectional replication, you simply do:

```js
localDB.replicate.to(remoteDB).on('complete', function () {
  // yay, we're done!
}).on('error', function (err) {
  // boo, something went wrong!
});
```

Congratulations, all changes from the `localDB` have been replicated to the `remoteDB`.

However, what if you want **bidirectional replication**? (Kinky!) You could do:

```js
localDB.replicate.to(remoteDB);
localDB.replicate.from(remoteDB);
```

However, to make things easier for your poor tired fingers, PouchDB has a shortcut API:

```js
localDB.sync(remoteDB);
```

These two code blocks above are equivalent. And the `sync` API supports all the same events as the `replicate` API:

```js
localDB.sync(remoteDB).on('complete', function () {
  // yay, we're in sync!
}).on('error', function (err) {
  // boo, we hit an error!
});
```

Live replication
---------

Live replication (or "continuous" replication) is a separate mode where changes are propagated between the two databases as the changes occur. In other words, normal replication happens once, whereas live replication happens in real time.

To enable live replication, you simply specify `{live: true}`:

```js
localDB.sync(remoteDB, {live: true});
```

However, there is one little gotcha with live replication: what if the user goes offline? In those cases, an error will be thrown, and you'll want to restart the replication process.

Luckily. PouchDB provides a way to do this:

```js
localDB.sync(remoteDB, {live: true}).on('change', function (change) {
  // yo, something changed!
}).on('error', function (err) {
  // yo, we got an error!
})));
```

When that `'error'` function is invoked, it's usually because of a network error. That means you can easily set up an infinite retry mechanism:

```js
function retryReplication() {
  localDB.sync(remoteDB, {live: true}).on('change', function (change) {
    // yo, something changed!
  }).on('error', function (err) {
    setTimeout(retryReplication, 5000);
  })));
}
```

A slightly more sophisicated technique is to do an [exponential backoff](https://en.wikipedia.org/wiki/Exponential_backoff). This will try to reconnect less and less frequently, until the user goes back online, at which point it resets.

```js
var timeout = 5000;
var backoff = 2;
function retryReplication() {
  localDB.sync(remoteDB, {live: true}).on('change', function (change) {
    // yo, something changed!
    timeout = 5000; // reset
  }).on('error', function (err) {
    setTimeout(function () {
      timeout *= backoff;
      retryReplication();
    }, timeout);
  });
}
```

This is ideal for scenarios where the user may be flitting in and out of connectivity, such as on mobile devices.

Related API documentation
--------

* [replication()](/api.html#replication)
* [sync()](/api.html#sync)

Next
-------

Now that we have a grasp on replication, let's talk about an inconvenient fact of life: conflicts.
