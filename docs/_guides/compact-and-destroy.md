---
index: 14
layout: guide
title: Compacting and destroying
sidebar: guides_nav.html
---

By default, PouchDB and CouchDB are designed to store all document revisions forever. This is very similar to how Git works, and it helps ensure that two databases can consistently replicate with each other.

However, if you allow your database to grow without bounds, it can end up taking up much more space than you need. This can especially be a problem in [browsers with storage quotas](/faq.html#data_limits).

To mitigate this problem, PouchDB offers two recourses: compaction and destruction.

Compacting a database
------

When you compact a database, you tell PouchDB to optimize its current storage usage. CouchDB will do the same thing:

```js
return db.compact().then(function (info) {
  // compaction complete
}).catch(function (err) {
  // handle errors
});
```

From the API perspective, nothing should be different about the database after compaction, *except* that non-leaf revisions will no longer be available.

```js
db.put({_id: 'foo', version: 1}).then(function () {
  return db.get('foo');
}).then(function (doc) {
  doc.version = 2;
  return db.put(doc);
}).then(function () { )
  return db.compact();
}).then(function () {
  // DANGER!
  // From now on, revision 1 is no longer available.
}).catch(function (err) {
  // handle errors
});
```

You can see a **[live example](http://bl.ocks.org/nolanlawson/ff6eb521793e3a199864)** of this code.

Compaction is a great feature, but it may not be what you desire if you want to retain a document's history from the beginning of time.

However, if that's not a concern, then compaction is a harmless operation. In fact, since leaf revisions are retained, this means that you can still do [conflict resolution](/guides/conflicts.html) after compaction!

Auto-compaction
------

If you really want to go all-in on compaction, then you can even put your database in `auto_compaction` mode. This means that it will automatically perform a `compact()` operation after every write.

```js
var db = new PouchDB('mydb', {auto_compaction: true});
db.put({_id: 'foo', version: 1}).then(function () {
  return db.get('foo');
}).then(function (doc) {
  doc.version = 2;
  return db.put(doc);
}).then(function () {
  // Revision 1 is already unavailable!
}).catch(function (err) {
  // handle errors
});
```

You can see a **[live example](http://bl.ocks.org/nolanlawson/b88f46d7cbaef8d93cba)** of this code.

This feature is only available in local databases, not remote ones. On remote databases, the `auto_compaction` option will do nothing.

Destroying a database
----

We all love our databases, but sometimes good things must come to an end, and you need to snub out a database completely.

So if you want to give your database to a nice farm family upstate, then the `destroy()` API is for you. It's very simple:

```js
new PouchDB('mydb').destroy().then(function () {
  // database destroyed
}).catch(function (err) {
  // error occurred
})
```

Or:

```js
PouchDB.destroy('mydb').then(function () {
  // database destroyed
}).catch(function (err) {
  // error occurred
})
```

These two methods are equivalent.

Note that destroying a database does not mean that replicated databases will also be destroyed. Destruction has nothing to do with the normal `put()`/`remove()` operations on documents, so it has no impact on replication.

Also note that in Web SQL, the database will not really be destroyed &ndash; it will just have its tables dropped. This is because Web SQL does not support true database deletion.

Related API documentation
--------

* [compact()](/api.html#compaction)
* [destroy()](/api.html#delete_database)

Next
----

To wrap up, let's look at a special class of documents in PouchDB &ndash; local docs.
