---
layout: 2ColLeft
title: API Reference
sidebar: api.html
---

Most of the PouchDB API is exposed as `fun(arg, [options], [callback])` where both the options and the callback are optional. Callbacks use the `function(err, result)` idiom where the first argument will be undefined unless there is an error, and the second argument holds the result. 

Additionally, any method that only returns a single thing (e.g. `db.get`) also returns a [promise][]. Promises come from the minimal library [lie][] in the browser, and the feature-rich [Bluebird][] in Node.

  [promise]: http://www.html5rocks.com/en/tutorials/es6/promises/
  [lie]: https://github.com/calvinmetcalf/lie
  [bluebird]: https://github.com/petkaantonov/bluebird

{% include anchor.html title="Create a database" hash="create_database" %}

{% highlight js %}
new PouchDB([name], [options])
{% endhighlight %}

This method creates a database or opens an existing one. If you use a URL like `'http://domain.com/dbname'` then PouchDB will work as a client to an online CouchDB instance.  Otherwise it will create a local database using whatever backend is present (i.e. IndexedDB, WebSQL, or LevelDB). 

### Options

* `options.name`: You can omit the `name` argument and specify it via `options` instead. Note that the name is required.
* `options.auto_compaction`: This turns on auto compaction (experimental). Defaults to `false`.
* `options.cache`: Appends a random string to the end of all HTTP GET requests to avoid them being cached on IE. Set this to `true` to prevent this happening (can also be set per request). Defaults to `false`.
* `options.adapter`: One of `'idb'`, `'leveldb'`, `'websql'`, or `'http'`. If unspecified, PouchDB will infer this automatically, preferring IndexedDB to WebSQL in browsers that support both (i.e. Chrome, Opera and Android 4.4+).

**Notes:** 

1. In IndexedDB and WebSQL, PouchDB will use `_pouch_` to prefix the internal database names. Do not manually create databases with the same prefix.
2. When acting as a client on Node, any other options given will be passed to [request][].
3. When using the `'leveldb'` adapter (the default on Node), any other options given will be passed to [levelup][]. The storage layer of leveldb can be replaced by passing a level backend factory (such as [MemDOWN][]) as `options.db`. The rest of the supported options are [documented here][levelup_options].

  [request]: https://github.com/mikeal/request
  [levelup]: https://github.com/rvagg/node-levelup
  [MemDOWN]: https://github.com/rvagg/memdown
  [levelup_options]: https://github.com/rvagg/node-levelup/#options

#### Example Usage:
{% highlight js %}
var db = new PouchDB('dbname');
// or
var db = new PouchDB('http://localhost:5984/dbname');
{% endhighlight %}

Create a WebSQL-only Pouch (e.g. when using the [SQLite Plugin][] for Cordova/PhoneGap):

  [sqlite plugin]: https://github.com/lite4cordova/Cordova-SQLitePlugin

{% highlight js %}
var db = new PouchDB('dbname', {adapter : 'websql'});
{% endhighlight %}

Create an in-memory Pouch (in Node):

{% highlight js %}
var db = new PouchDB('dbname', {db : require('memdown')});
{% endhighlight %}

{% include anchor.html title="Delete a database" hash="delete_database"%}

{% highlight js %}
db.destroy([options], [callback])
{% endhighlight %}

Delete database.

**Notes:** With a remote CouchDB on Node, options are passed to [request][].

#### Example Usage:
{% highlight js %}
db.destroy(function(err, info) { });
{% endhighlight %}

You can also delete a database using just the name:

{% highlight js %}
PouchDB.destroy('dbname', function(err, info) { });
{% endhighlight %}

{% include anchor.html title="Create / update a document" hash="create_document" %}

### Using db.put()
{% highlight js %}
db.put(doc, [docId], [docRev], [options], [callback])
{% endhighlight %}

Create a new document or update an existing document. If the document already exists, you must specify its revision `_rev`, otherwise a conflict will occur.

There are some restrictions on valid property names of the documents. These are explained [here](http://wiki.apache.org/couchdb/HTTP_Document_API#Special_Fields).

#### Example Usage:

Create a new doc with an `_id`:

{% highlight js %}
db.put({
  title: 'Heroes'
}, 'mydoc'), function(err, response) { });
{% endhighlight %}

Like all methods, you can also use a promise:

{% highlight js %}
db.put({
  title: 'Lady Stardust'
}, 'myOtherDoc').then(function(response) { });
{% endhighlight %}

Update an existing doc using `_rev`:

{% highlight js %}
db.get('myOtherDoc', function(err, otherDoc) {
  db.put({
    title: "Let's Dance",
  }, 'myOtherDoc', otherDoc._rev, function(err, response) { });
});
{% endhighlight %}

You can also include the `_id` and `_rev` directly in the document:

{% highlight js %}
db.get('myOtherDoc').then(function(otherDoc) {
  return db.put({
    _id: 'myOtherDoc',
    _rev: otherDoc._rev,
    title: 'Be My Wife',
  });
}, function(err, response) {
  if (err) {
    // on error
  } else {
    // on success
  }
});

{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "ok": true,
  "id": "mydoc",
  "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
}
{% endhighlight %}

### Using db.post()
{% highlight js %}
db.post(doc, [options], [callback])
{% endhighlight %}

Create a new document and let PouchDB generate an `_id` for it.

#### Example Usage:
{% highlight js %}
db.post({
  title: 'Ziggy Stardust'
}, function (err, response) { });
{% endhighlight %}

### Example Response:
{% highlight js %}
{
  "ok" : true,
  "id" : "8A2C3761-FFD5-4770-9B8C-38C33CED300A",
  "rev" : "1-d3a8e0e5aa7c8fff0c376dac2d8a4007"
}
{% endhighlight %}

**Put vs. post**: The basic rule of thumb is: `put()` new documents with an `_id`, `post()` new documents without an `_id`.

{% include anchor.html title="Fetch a document" hash="fetch_document"%}

{% highlight js %}
db.get(docId, [options], [callback])
{% endhighlight %}

Retrieves a document, specified by `docId`.

### Options

All options default to `false` unless otherwise specified.

* `options.rev`: Fetch specific revision of a document. Defaults to winning revision (see [the CouchDB guide](http://guide.couchdb.org/draft/conflicts.html)).
* `options.revs`: Include revision history of the document.
* `options.revs_info`: Include a list of revisions of the document, and their availability.
* `options.open_revs`: Fetch all leaf revisions if `open_revs="all"` or fetch all leaf revisions specified in `open_revs` array. Leaves will be returned in the same order as specified in input array.
* `options.conflicts`: If specified, conflicting leaf revisions will be attached in `_conflicts` array.
* `options.attachments`: Include attachment data.
* `options.local_seq`: Include sequence number of the revision in the database.
* `options.ajax`: An object of options to be sent to the ajax requester. In Node they are sent ver batim to [request][] with the exception of:
    * `options.ajax.cache`: Appends a random string to the end of all HTTP GET requests to avoid them being cached on IE. Set this to `true` to prevent this happening.


#### Example Usage:

{% highlight js %}
db.get('mydoc', function(err, doc) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "title": "Rock and Roll Heart",
  "_id": "mydoc",
  "_rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
}
{% endhighlight %}

{% include anchor.html title="Delete a document" hash="delete_document"%}

{% highlight js %}
db.remove(doc, [options], [callback])
{% endhighlight %}

Or:

{% highlight js %}
db.remove(docId, docRev, [options], [callback])
{% endhighlight %}


Deletes the document. `doc` is required to be a document with at least an `_id` and a `_rev` property. Sending the full document will work as well.

#### Example Usage:
{% highlight js %}
db.get('mydoc', function(err, doc) {
  db.remove(doc, function(err, response) { });
  // or:
  db.remove(doc._id, doc._rev, function(err, response) { });
});
{% endhighlight %}

### With Promises:
{% highlight js %}
db.get('mydoc').then(function(doc) {
  return db.remove(doc);
}).catch(function(err){
  //errors
});
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "ok": true,
  "id": "mydoc",
  "rev": "2-9AF304BE281790604D1D8A4B0F4C9ADB"
}
{% endhighlight %}

{% include anchor.html title="Create/update a batch of documents" hash="batch_create" %}

{% highlight js %}
db.bulkDocs(docs, [options], [callback])
{% endhighlight %}

Create, update or delete multiple documents. The `docs` argument is an array of documents, or an object with property `docs` which is the array of documents.

If you omit an `_id` parameter on a given document, the database will create a new document and assign the ID for you. To update a document, you must include both an `_id` parameter and a `_rev` parameter, which should match the ID and revision of the document on which to base your updates. Finally, to delete a document, include a `_deleted` parameter with the value `true`.

#### Example Usage:

Post some new docs and auto-generate the `_id`s:

{% highlight js %}
db.bulkDocs([
  {title : 'Lisa Says'},
  {title : 'Space Oddity'}
], function(err, response) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
[
    {
        "ok": true, 
        "id": "06F1740A-8E8A-4645-A2E9-0D8A8C0C983A", 
        "rev": "1-84abc2a942007bee7cf55007cba56198"
    }, 
    {
        "ok": true, 
        "id": "6244FB45-91DB-41E5-94FF-58C540E91844", 
        "rev": "1-7b80fc50b6af7a905f368670429a757e"
    }
]
{% endhighlight %}

#### Bulk update/delete:

Then you can update those same docs:

{% highlight js %}
db.bulkDocs([
  {
    title  : 'Lisa Says', 
    artist : 'Velvet Underground',
    _id    : "06F1740A-8E8A-4645-A2E9-0D8A8C0C983A", 
    _rev   : "1-84abc2a942007bee7cf55007cba56198"
  },
  {
    title  : 'Space Oddity',
	artist : 'David Bowie',
    _id    : "6244FB45-91DB-41E5-94FF-58C540E91844", 
    _rev   : "1-7b80fc50b6af7a905f368670429a757e"
  }
], function(err, response) { });
{% endhighlight %}

Or delete them:

{% highlight js %}
db.bulkDocs([
  {
    title    : 'Lisa Says', 
    _deleted : true,
    _id      : "06F1740A-8E8A-4645-A2E9-0D8A8C0C983A", 
    _rev     : "1-84abc2a942007bee7cf55007cba56198"
  },
  {
    title    : 'Space Oddity',
	_deleted : true,
    _id      : "6244FB45-91DB-41E5-94FF-58C540E91844", 
    _rev     : "1-7b80fc50b6af7a905f368670429a757e"
  }
], function(err, response) { });
{% endhighlight %}

**Note:** You can also specify a `new_edits` property on the `docs` object that when set to `false` allows you to post and overwrite [existing documents](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API#Posting_Existing_Revisions). Normally only the replication algorithm needs to do this.

{% include anchor.html title="Fetch a batch of documents" hash="batch_fetch" %}

{% highlight js %}
db.allDocs([options], [callback])
{% endhighlight %}

Fetch multiple documents.  Deleted documents are only included if `options.keys` is specified.

### Options

All options default to `false` unless otherwise specified.

* `options.include_docs`: Include the document itself in each row in the `doc` field. Otherwise by default you only get the `_id` and `_rev` properties.
    - `options.conflicts`: Include conflict information in the `_conflicts` field of a doc.
  - `options.attachments`: Include attachment data.
* `options.startkey` & `options.endkey`: Get documents with IDs in a certain range (inclusive/inclusive).
* `options.inclusive_end`: Include documents having an ID equal to the given `options.endkey`. Default: `true`.
* `options.limit`: Maximum number of documents to return.
* `options.skip`: Number of docs to skip before returning (warning: poor performance on IndexedDB/LevelDB!).
* `options.descending`: Reverse the order of the output documents.
* `options.key`: Only return documents with IDs matching this string key.
* `options.keys`: Array of string keys to fetch in a single shot.
    - Neither `startkey` nor `endkey` can be specified with this option.
    - The rows are returned in the same order as the supplied `keys` array.
    - The row for a deleted document will have the revision ID of the deletion, and an extra key `"deleted":true` in the `value` property.
    - The row for a nonexistent document will just contain an `"error"` property with the value `"not_found"`.
    - For details, see the [CouchDB query options documentation](http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options).

**Notes:** For pagination, `options.limit` and `options.skip` are also available, but the same performance concerns as in CouchDB apply. Use the [startkey/endkey pattern](http://docs.couchdb.org/en/latest/couchapp/views/pagination.html) instead. `total_rows` is the total number of documents in the database.

#### Example Usage:
{% highlight js %}
db.allDocs({include_docs: true}, function(err, response) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "offset": 0,
  "total_rows": 1,
  "rows": [{
    "doc": {
      "_id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      "_rev": "1-5782E71F1E4BF698FA3793D9D5A96393",
      "title": "Sound and Vision"
    },
   "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
   "key": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
   "value": {
    "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
   }
 }]
}
{% endhighlight %}

{% include anchor.html title="Listen to database changes" hash="changes" %}

{% highlight js %}
db.changes(options)
{% endhighlight %}

A list of changes made to documents in the database, in the order they were made.
It returns an object with the method `cancel()`, which you call if you don't want to listen to new changes anymore. 

It is an [event emitter][event emitter] and will emit a `'change'` event on each document change, a `'complete'` event when all the changes have been processed, and an `'error'` event when an error occurs. In addition to the `'change'` event, any change will also emit a `'create'`, `'update'`, or `'delete'` event.

### Options

All options default to `false` unless otherwise specified.

* `options.include_docs`: Include the associated document with each change.
  * `options.conflicts`: Include conflicts.
  * `options.attachments`: Include attachments.
* `options.descending`: Reverse the order of the output documents.
* `options.filter`: Reference a filter function from a design document to selectively get updates.
* `options.since`: Start the results from the change immediately after the given sequence number, you can also pass 'now' if you want only new changes.
* `options.live`: Use _longpoll_ feed. 
* `options.limit`: Limit the number of results to this number.
* `options.style`: Specifies how many revisions are returned in the changes array. The default, main_only, will only return the current "winning" revision; all_docs will return all leaf revisions (including conflicts and deleted former conflicts).
* `options.view`: Specify a view function to act as a filter. Documents counted as "passed" for a view filter if a map function emits at least one record for them.
* `options.returnDocs`: Is available for non http databases and defaults to true, passing `false` prevents the changes feed from keeping all the documents in memory, in other words complete always has an empty results array, and the `change` event is the only way to get the event. Useful for large change sets where otherwise you would run out of memory.

#### Example Usage:
{% highlight js %}
var changes = db.changes({
  since: 20,
  live: true
}).on('change', function(change) { });

changes.cancel();
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "id":"somestuff",
  "seq":21,
  "changes":[{
    "rev":"1-8e6e4c0beac3ec54b27d1df75c7183a8"
  }],
  "doc":{
    "title":"Ch-Ch-Ch-Ch-Changes",
    "_id":"someDocId",
    "_rev":"1-8e6e4c0beac3ec54b27d1df75c7183a8"
  }
}
{% endhighlight %}

#### Example Usage:
{% highlight js %}
db.changes()
  .on('error', function (err) {})
  .on('complete', function (resp) {});
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "results": [{
    "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
    "seq": 1,
    "changes": [{
      "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
    }]
  }, {
    "id": "mydoc",
    "seq": 2,
    "changes": [{
      "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
    }]
  }, {
    "id": "otherdoc",
    "seq": 3,
    "changes": [{
      "rev": "1-3753476B70A49EA4D8C9039E7B04254C"
    }]
  }, {
    "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
    "seq": 4,
    "changes": [{
      "rev": "1-A8BC08745E62E58830CA066D99E5F457"
    }]
  }]
}
{% endhighlight %}

**Note:**

* The `changes()` method was not an event emitter before PouchDB 2.2.0, and instead of the `'change'` and `'complete'` events it took `complete` and `onChange` function options. This is deprecated and could be removed in PouchDB version 3.
* The `'since'`option formally took 'latest' but has been changed to 'now' to keep consistency with CouchDB, 'latest' is deprecated but will still work to ensure backwards compatibility.

{% include anchor.html title="Replicate a database" hash="replication" %}

{% highlight js %}
PouchDB.replicate(source, target, [options])
{% endhighlight %}

Replicate data from `source` to `target`.  Both the `source` and `target` can be a PouchDB instance or a string representing a CouchDB database url or the name a local PouchDB database. If `options.live` is `true`, then this will track future changes and also replicate them automatically.

Replication is an event emiter like `changes()` and emits the `'complete'`, `'uptodate'`, `'change'` and `'error'` events.

### Options

All options default to `false` unless otherwise specified.

* `options.filter`: Reference a filter function from a design document to selectively get updates.
* `options.query_params`: Query params sent to the filter function.
* `options.doc_ids`: Only replicate docs with these ids.
* `options.live`: If `true`, starts subscribing to future changes in the `source` database and continue replicating them.
* `options.since`: Replicate changes after the given sequence number.
* `options.server`: Initialize the replication on the server. The response is the CouchDB `POST _replicate` response and is different from the PouchDB replication response. Also, `options.onChange` is not supported on server replications.
* `options.create_target`: Create target database if it does not exist. Only for server replications.
* `options.batch_size`: Number of documents to process at a time. Defaults to 100. This affects the number of docs held in memory and the number sent at a time to the target server. You may need to adjust downward if targeting devices with low amounts of memory (e.g. phones) or if the documents are large in size (e.g. with attachments). If your documents are small in size, then increasing this number will probably speed replication up.
* `options.batches_limit`: Number of batches to process at a time. Defaults to 10. This (along wtih `batch_size`) controls how many docs are kept in memory at a time, so the maximum docs in memory at once would equal `batch_size` &times; `batches_limit`.

#### Example Usage:
{% highlight js %}
PouchDB.replicate('mydb', 'http://localhost:5984/mydb')
  .on('change', function (info) {
    // handle change
  }).on('complete', function (info) {
    // handle complete
  }).on('uptodate', function (info) {
    // handle up-to-date
  }).on('error', function (err) {
    // handle error
  });
{% endhighlight %}

There are also shorthands for replication given existing PouchDB objects. These behave the same as `PouchDB.replicate()`:

{% highlight js %}
db.replicate.to(remoteDB, [options]);
// or
db.replicate.from(remoteDB, [options]);
{% endhighlight %}

**Notes:**

* The `'complete'` event only fires when you aren't doing live replication, or when live replication fails.
* The `'uptodate'` event fires during live replication, when the target database is up-to-date and just idling, waiting for new changes.

#### Example Response:

Example response in the `'change'` listener:

{% highlight js %}
{
  "doc_write_failures": 0, 
  "docs_read": 1, 
  "docs_written": 1, 
  "errors": [], 
  "last_seq": 1, 
  "ok": true, 
  "start_time": "Fri May 16 2014 18:23:12 GMT-0700 (PDT)"
}
{% endhighlight %}

Example response in the `'complete'` listener:

{% highlight js %}
{
  "doc_write_failures": 0, 
  "docs_read": 2, 
  "docs_written": 2, 
  "end_time": "Fri May 16 2014 18:26:00 GMT-0700 (PDT)", 
  "errors": [], 
  "last_seq": 2, 
  "ok": true, 
  "start_time": "Fri May 16 2014 18:26:00 GMT-0700 (PDT)", 
  "status": "complete"
}
{% endhighlight %}

**Notes:**

* The response for server replications (via `options.server`) is slightly different. See the [CouchDB replication documentation](http://wiki.apache.org/couchdb/Replication) for details.
* The `'live'` option was formerly called `'continuous'`. You can still use `'continuous'` if you can spell it.
* The replicate() method was not an event emitter before PouchDB 2.2.0, and instead of the `'change'` and `'complete'` events it took `complete` and `onChange` function options. This is deprecated and could be removed in PouchDB version 3.

{% include anchor.html title="Sync a database" hash="sync" %}

{% highlight js %}
var sync = PouchDB.sync(src, target, [options])
{% endhighlight %}

Sync data from `src` to `target` and `target` to `src`. This is a convience method for bidirectional data replication.

### Options

Please refer to [Replication](api.html#replication) for documention on options, as sync is just a convience method that entails bidirectional replication.

#### Example Usage:
{% highlight js %}
PouchDB.sync('http://localhost:5984/mydb')
  .on('change', onChange)
  .on('complete', onComplete)
  .on('error', onError);
{% endhighlight %}

There is also a shorthand for syncing given existing PouchDB objects. This behaves the same as `PouchDB.sync()`:

{% highlight js %}
db.sync(remoteDB, [options]);
{% endhighlight %}

For any further details, please further to [Replication](api.html#replication).

{% include anchor.html title="Save an attachment" hash="save_attachment" %}

{% highlight js %}
db.putAttachment(docId, attachmentId, rev, doc, type, [callback]);
{% endhighlight %}

Attaches a binary object to a document. Most of PouchDB's API deals with JSON, but if you're dealing with large binary data (such as PNGs), you may incur a performance or storage penalty if you simply include them as base64- or hex-encoded strings. In these cases, you can store the binary data as an attachment. For details, see the [CouchDB documentation on attachments](https://wiki.apache.org/couchdb/HTTP_Document_API#Attachments).

#### Example Usage:
{% highlight js %}
var doc = new Blob(["It's a God awful small affair"]);
db.putAttachment('a', 'text', rev, doc, 'text/plain', function(err, res) {})
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "ok": true,
  "id": "otherdoc",
  "rev": "2-068E73F5B44FEC987B51354DFC772891"
}
{% endhighlight %}

Within Node, you must use a `Buffer` instead of a `Blob`:

{% highlight js %}
var doc = new Buffer("It's a God awful small affair");
{% endhighlight %}

For details, see the [Mozilla docs on `Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or the [Node docs on `Buffer`](http://nodejs.org/api/buffer.html).  If you need a shim for older browsers that don't support the `Blob` constructor, you can use [this one](https://gist.github.com/nolanlawson/10340255).

### Save an inline attachment

You can also inline attachments inside the document. In this case, the attachment data must be supplied as a base64-encoded string:

{% highlight js %}
{
  '_id': 'otherdoc',
  'title': 'Legendary Hearts',
  '_attachments': {
    "text": {
      "content_type": "text/plain",
       "data": "TGVnZW5kYXJ5IGhlYXJ0cywgdGVhciB1cyBhbGwgYXBhcnQKT" +
         "WFrZSBvdXIgZW1vdGlvbnMgYmxlZWQsIGNyeWluZyBvdXQgaW4gbmVlZA=="
    }
  }
}
{% endhighlight %}

See [Inline Attachments](http://wiki.apache.org/couchdb/HTTP_Document_API#Inline_Attachments)
on the CouchDB wiki for details.

{% include anchor.html title="Get an attachment" hash="get_attachment" %}

{% highlight js %}
db.getAttachment(docId, attachmentId, [options], [callback])
{% endhighlight %}

Get attachment data.

#### Example Usage:

{% highlight js %}
db.getAttachment('otherdoc', 'text', function(err, res) { });
{% endhighlight %}

In Node you get `Buffer`s, and in the browser you get `Blob`s.

### Inline attachments

You can specify `attachments: true` to most read operations. The attachment data will then be included inlined in the resulting list of docs.

{% include anchor.html title="Delete an attachment" hash="delete_attachment" %}

{% highlight js %}
db.removeAttachment(docId, attachmentId, rev, [callback])
{% endhighlight %}

Delete an attachment from a doc.

#### Example Usage:
{% highlight js %}
db.removeAttachment('otherdoc',
                    'text',
                    '2-068E73F5B44FEC987B51354DFC772891',
                    function(err, res) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "ok": true,
  "rev": "3-1F983211AB87EFCCC980974DFC27382F"
}
{% endhighlight %}

{% include anchor.html title="Query the database" hash="query_database" %}

{% highlight js %}
db.query(fun, [options], [callback])
{% endhighlight %}

Retrieves a view, which allows you to perform more complex queries on PouchDB. The [CouchDB documentation for map/reduce](http://docs.couchdb.org/en/latest/couchapp/views/intro.html) applies to PouchDB.

Since views perform a full scan of all documents, this method may be slow, unless you first save your view in a design document.

### Options

All options default to `false` unless otherwise specified.

* `fun`: Map/reduce function, which can be one of the following: 
  * A map function by itself (no reduce).
  * A full CouchDB-style map/reduce object: `{map : ..., reduce: ...}`.
  * The name of a view in an existing design document (e.g. `'myview'` or `'mydesigndoc/myview'`).
* `options.reduce`: Reduce function, or the string name of a built-in function: `'_sum'`, `'_count'`, or `'_stats'`.  Defaults to `false` (no reduce).
    * Tip: if you're not using a built-in, [you're probably doing it wrong](http://youtu.be/BKQ9kXKoHS8?t=865s).
    * On local databases, `rereduce` will always be `false` (since it's single-node).
* `options.include_docs`: Include the document in each row in the `doc` field.
    - `options.conflicts`: Include conflicts in the `_conflicts` field of a doc.
  - `options.attachments`: Include attachment data.
* `options.startkey` & `options.endkey`: Get rows with keys in a certain range (inclusive/inclusive).
* `options.inclusive_end`: Include rows having a key equal to the given `options.endkey`. Default: `true`.
* `options.limit`: Maximum number of rows to return.
* `options.skip`: Number of rows to skip before returning (warning: poor performance on IndexedDB/LevelDB!).
* `options.descending`: Reverse the order of the output rows.
* `options.key`: Only return rows matching this key.
* `options.keys`: Array of keys to fetch in a single shot.
    - Neither `startkey` nor `endkey` can be specified with this option.
    - The rows are returned in the same order as the supplied `keys` array.
    - The row for a deleted document will have the revision ID of the deletion, and an extra key `"deleted":true` in the `value` property.
    - The row for a nonexistent document will just contain an `"error"` property with the value `"not_found"`.
* `options.group`: True if you want the reduce function to group results by keys, rather than returning a single result. Defaults to `false`. 
* `options.group_level`: Number of elements in a key to group by, assuming the keys are arrays. Defaults to the full length of the array.
* `options.stale`: One of `'ok'` or `'update_after'`.  Only applies to saved views. Can be one of:
    * unspecified (default): Returns the latest results, waiting for the view to build if necessary.
    * `'ok'`: Returns results immediately, even if they're out-of-date.
    * `'update_after'`: Returns results immediately, but kicks off a build afterwards.

For details, see the [CouchDB query options documentation](http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options).

#### Example Usage:
{% highlight js %}
function map(doc) {
  if (doc.title) {
    emit(doc.title);
  }
}

db.query({map: map}, {reduce: false}, function(err, response) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "offset" : 0,
  "rows": [{
    "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
    "key": "Cony Island Baby",
    "value": null
  }, {
    "id": "otherdoc",
    "key": "Legendary Hearts",
    "value": null
  }, {
    "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
    "key": "Lisa Says",
    "value": null
  }, {
    "id": "mydoc",
    "key": "Rock and Roll Heart",
    "value": null
  }],
  "total_rows" : 4
}
{% endhighlight %}

**Note:** `total_rows` is the total number of possible results in the view.

#### Complex keys

You can also use [complex keys](https://wiki.apache.org/couchdb/Introduction_to_CouchDB_views#Complex_Keys) for fancy ordering:

{% highlight js %}
function map(doc) {
  // sort by last name, first name, and age
  emit([doc.lastName, doc.firstName, doc.age]);
}
db.query(map, function (err, response) {});
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "offset": 0,
  "rows": [{
      "id"  : "bowie",
      "key" : ["Bowie", "David", 67]
    }, {
      "id"  : "dylan",
      "key" : ["Dylan", "Bob", 72]
    }, {
      "id"  : "younger_dylan",
      "key" : ["Dylan", "Jakob", 44]
    }, {
      "id"  : "hank_the_third",
      "key" : ["Williams", "Hank", 41]
    }, {
      "id"  : "hank",
      "key" : ["Williams", "Hank", 91]
    }],
  "total_rows": 5
}
{% endhighlight %}

**Tips:** 

* CouchDB sorts objects last, so `{startkey: ['Williams'], endkey: ['Williams', {}]}` would return all people with the last name `'Williams'`.
* `group_level` can be very helpful when working with complex keys.  In the example above, you can use `{group_level: 1}` to group by last name, or `{group_level: 2}` to group by last and first name.

#### Linked documents

PouchDB fully supports [linked documents](https://wiki.apache.org/couchdb/Introduction_to_CouchDB_views#Linked_documents). Use them to join two types of documents together, by simply adding an `_id` to the emitted value:

{% highlight js %}
function map(doc) {
  // join artist data to albums
  if (doc.type === 'album') {
    emit(doc.name, {_id : doc.artistId, albumYear : doc.year});
  }
}
db.query(map, {include_docs : true}, function (err, response) {});
{% endhighlight %}

#### Example response:

{% highlight js %}
{
    "offset": 0,
    "rows": [
        {
            "doc": {
                "_id": "bowie",
                "_rev": "1-fdb234b78904a5c8293f2acf4be70d44",
                "age": 67,
                "firstName": "David",
                "lastName": "Bowie"
            },
            "id": "album_hunkydory",
            "key": "Hunky Dory",
            "value": {
                "_id": "album_hunkydory",
                "albumYear": 1971
            }
        },
        {
            "doc": {
                "_id": "bowie",
                "_rev": "1-fdb234b78904a5c8293f2acf4be70d44",
                "age": 67,
                "firstName": "David",
                "lastName": "Bowie"
            },
            "id": "album_low",
            "key": "Low",
            "value": {
                "_id": "album_low",
                "albumYear": 1977
            }
        },
        {
            "doc": {
                "_id": "bowie",
                "_rev": "1-fdb234b78904a5c8293f2acf4be70d44",
                "age": 67,
                "firstName": "David",
                "lastName": "Bowie"
            },
            "id": "album_spaceoddity",
            "key": "Space Oddity",
            "value": {
                "_id": "album_spaceoddity",
                "albumYear": 1969
            }
        }
    ],
    "total_rows": 3
}
{% endhighlight %}

#### Closures

If you pass a function to `db.query` and give it the `emit` function as the second argument, then you can use a closure. (Otherwise we have to use `eval()` to bind `emit`.)

{% highlight js %}
// BAD! will throw error
var myId = 'foo';
db.query(function(doc) {
  if (doc._id === myId) {
    emit(doc);
  }
}, function(err, results) { /* ... */ });

// will be fine
var myId = 'foo';
db.query(function(doc, emit) {
  if (doc._id === myId) {
    emit(doc);
  }
}, function(err, results) { /* ... */ });
{% endhighlight %}

You don't actuallly have to call them by those names, though:
{% highlight js %}
var myId = 'foo';
db.query(function(thisIs, awesome) {
  if (thisIs._id === myId) {
    awesome(thisIs); 
  }
}, function(err, results) { /* ... */ });
{% endhighlight %}

Note that closures are only supported by local databases with temporary views.

{% include anchor.html title="View cleanup" hash="view_cleanup" %}

{% highlight js %}
db.viewCleanup([options], [callback])
{% endhighlight %}

Cleans up any stale map/reduce indexes.

As design docs are deleted or modified, their associated index files (in CouchDB) or companion databases (in local PouchDBs) continue to take up space on disk. `viewCleanup()` removes these unnecessary index files.

See [the CouchDB documentation on view cleanup](http://couchdb.readthedocs.org/en/latest/maintenance/compaction.html#views-cleanup) for details.

#### Example Usage:
{% highlight js %}
db.viewCleanup([options], [callback])
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "ok" : "true"
}
{% endhighlight %}

{% include anchor.html title="Get database information" hash="database_information" %}

{% highlight js %}
db.info(callback)
{% endhighlight %}

Get information about a database.

#### Example Usage:
{% highlight js %}
db.info(function(err, info) { })
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "db_name": "test",
  "doc_count": 4,
  "update_seq": 5
}
{% endhighlight %}

**Response object:**

* `db_name` is the name of the database you gave when you called `new PouchDB()`, and also the unique identifier for the database.
* `doc_count` is the total number of non-deleted documents in the database.
* `update_seq` is the sequence number of the database.  It starts at 0 and gets incremented every time a document is added or modified.

{% include anchor.html title="Compact the database" hash="compaction" %}

{% highlight js %}
db.compact([options], [callback])
{% endhighlight %}

Runs compaction of the database. Fires callback when compaction is done. If you use the http adapter and have specified a callback, Pouch will ping the remote database in regular intervals unless the compaction is finished.

* `options.interval`: Number of milliseconds Pouch waits before asking again if compaction is already done. Only for http adapter.

{% include anchor.html title="Document revisions diff" hash="revisions_diff" %}

{% highlight js %}
db.revsDiff(diff, [callback])
{% endhighlight %}

Given a set of document/revision IDs, returns the subset of those that do not correspond
to revisions stored in the database. Primarily used in replication.

#### Example Usage:
{% highlight js %}
db.revsDiff({
  myDoc1: [
    "1-b2e54331db828310f3c772d6e042ac9c",
    "2-3a24009a9525bde9e4bfa8a99046b00d"
  ]
}, function (err, diffs) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "myDoc1": {
    "missing": ["2-3a24009a9525bde9e4bfa8a99046b00d"]
  }
}
{% endhighlight %}

{% include anchor.html title="Events" hash="events"%}

PouchDB is an [event emitter][event emitter] and will emit a `'created'` event when a database is created. A `'destroyed'` event is emitted when a database is destroyed.

{% highlight js %}
PouchDB.on('created', function (dbName) {
  // called whenver a db is created.
});
PouchDB.on('destroyed', function (dbName) {
  // called whenver a db is destroyed.
});
{% endhighlight %}

{% include anchor.html title="Plugins" hash="plugins"%}

Writing a plugin is easy! The API is:

{% highlight js %}
PouchDB.plugin({
  methodName: myFunction
});
{% endhighlight %}

This will add the function as a method of all databases with the given method name.  It will always be called in context, so that `this` always refers to the database object.

We also offer a [PouchDB Plugin Seed project](https://github.com/pouchdb/plugin-seed), which is the fastest way to get started writing, building and testing your very own plugin.

#### Example Usage:
{% highlight js %}
PouchDB.plugin({
  sayMyName : function () {
    this.info().then(function (info)   {
      console.log('My name is ' + info.db_name);
    }).catch(function (err) { });
  }
});
new PouchDB('foobar').sayMyName(); // prints "My name is foobar"
{% endhighlight %}

[event emitter]: http://nodejs.org/api/events.html#events_class_events_eventemitter
