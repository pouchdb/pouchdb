---
index: 8
layout: guide
title: Bulk operations
sidebar: guides_nav.html
---

You can `get()`, `put()`, and `remove()` single documents to your heart's content, but a database isn't a database unless it can handle many operations at once!

PouchDB provides two methods for bulk operations - `bulkDocs()` for bulk writes, and `allDocs()` for bulk reads.

Use `bulkDocs()` to write many docs
----

The `bulkDocs()` API is very simple.  It just takes a list of documents that you want to `put()` into the database:

```js
db.bulkDocs([
  {
    _id: 'mittens',
    occupation: 'kitten',
    cuteness: 9.0
  },
  {
    _id: 'katie',
    occupation: 'kitten',
    cuteness: 7.0
  },
  {
    _id: 'felix',
    occupation: 'kitten',
    cuteness: 8.0
  }
]);
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/038a45134341f3b7235b)** of this code.

This code is equivalent to `put()`ing each document separately:

```js
db.put({
    _id: 'mittens',
    occupation: 'kitten',
    cuteness: 9.0
}).then(function () {
  return db.put({
    _id: 'katie',
    occupation: 'kitten',
    cuteness: 7.0
  });
}).then(function () {
  return db.put({
    _id: 'felix',
    occupation: 'kitten',
    cuteness: 8.0
  });
]);
```

Why bulk up with `bulkDocs()`?
----

Bulk operations tend to be faster than individual operations, because they can be combined into a single transaction (in a local IndexedDB/WebSQL) or a single HTTP request (in a remote CouchDB).

You can also update or delete multiple documents this way. You just need to include the `_rev` and `_deleted` values as previously discussed. The same rules as for `put()` apply to each individual document.

{% include alert/start.html variant="warning" %}

Neither <code>bulkDocs()</code> nor <code>allDocs()</code> constitutes a transaction in the traditional sense. That means that, if a single <code>put()</code> fails, you should not assume that the others will fail.
<p/>
<p/>
By design, CouchDB and PouchDB do not support transactions. A document is the smallest unit of operations.
{% include alert/end.html %}

Use `allDocs()` to read many docs
--------

Likewise, `allDocs()` is a method that allows you to read many documents at once.

Most crucially, when you read from `allDocs()`, the documents are returned *sorted by order of `_id`*.  This makes the `_id` a very powerful field that you can use for more than just uniquely identifying your documents.

For instance, if you refer back to [the live example](http://bl.ocks.org/nolanlawson/038a45134341f3b7235b) above, you'll notice that the kittens are sorted by their name, because their names are used as their `_id`s.

Another common way to take advantage of this is to use `new Date().toJSON()` as your document `_id`s. In this way, all your documents will be sorted by date.

For instance, let's save three kittens with three different dates, and then fetch them sorted by date:

```js
db.put({
    _id: new Date().toJSON(),
    name: 'Mittens',
    occupation: 'kitten',
    cuteness: 9.0
}).then(function () {
  return db.put({
    _id: new Date().toJSON(),
    name: 'Katie',
    occupation: 'kitten',
    cuteness: 7.0
  });
}).then(function () {
  return db.put({
    _id: new Date().toJSON(),
    name: 'Felix',
    occupation: 'kitten',
    cuteness: 8.0
  });
]).then(function () {
  return db.allDocs({include_docs: true});
}).then(function (response) {
  console.log(response);
}).catch(function (err) {
  console.log(err);
});
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/8f58dbc360348a4c95f6)** to confirm that the kittens are sorted by the order they were put into the database.

Please use `allDocs()`. Seriously.
-------

`allDocs()` is the unsung star of the PouchDB world. It not only returns documents in order &ndash; it also allows you to reverse the order, filter by `_id`, slice and dice using "greater than" and "less than" operations on the `_id`, and much more.

Far too many developers overlook this valuable API, because they misunderstand it. When a developer says "my PouchDB app is slow!", it is usually because they are using the slow `query()` API when they should be using the fast `allDocs()` API.

For details on how to effectively use `allDocs()`, you are strongly recommended to read ["Pagination strategies with PouchDB"](http://pouchdb.com/2014/04/14/pagination-strategies-with-pouchdb.html). For 99% of your applications, you should be able to use `allDocs()` for all the pagination/sorting/searching functionality that you need.

Related API documentation
--------

* [bulkDocs()](/api.html#batch_create)
* [allDocs()](/api.html#batch_fetch)

Next
------

Now that you've fallen helplessly in love with `bulkDocs()` and `allDocs()`, let's turn our wandering gaze to attachments.