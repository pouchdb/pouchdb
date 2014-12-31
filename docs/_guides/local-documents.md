---
index: 15
layout: guide
title: Local documents
sidebar: guides_nav.html
---

"Local" documents are a special class of documents in PouchDB and CouchDB, which are used for storing local metadata about a database. You might never need them in your own app, but sometimes they can come in handy for advanced use cases.

Local docs in a nutshell
--------

Local docs have the following characteristics:

* They don't replicate.
* They can't contain attachments.
* They don't appear in `allDocs()`, `changes()`, or `query()`.
* However, you can modify them with `put()`/`remove()`/`bulkDocs()`, and you can fetch them with `get()`.

So basically, local docs only exist *for that database*, and they don't mix with the "normal" documents.

To create a local doc, you simply use `'_local/'` as the prefix of the `_id`. This is supported in both CouchDB and PouchDB:

```js
db.put({
  _id: '_local/foobar',
  someText: 'yo, this is my local doc!'
}).then(function () {
  return db.get('_local/foobar');
});
```

Advantages of local docs
---------

Local docs are useful for small bits of configuration or metadata, which you don't necessarily want to replicate, but which you want to keep in the database anyway. Many PouchDB plugins and core components use local docs. For instance, the replication algorithm uses them to store checkpoints, and map/reduce uses them to keep track of what's been `emit`ted.

Local docs also have some good performance characteristics compared to regular docs. They don't have a version history, so only the most recent revision is ever stored in the database. This means that `put()`s and `get()`s are faster for local docs than for regular docs, and that local docs tend to take up less space on disk.  In a sense, they are auto-compacted, although they take up even less space on disk than documents in a compacted database.

Regardless, you need to provide the current `_rev` when you update local docs, just like with regular docs.

Related API documentation
--------

* [put()](/api.html#create_document)
* [get()](/api.html#fetch_document)
* [remove()](/api.html#delete_document)
