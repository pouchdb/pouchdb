---
layout: learn
title: API Reference - PouchDB
---

# API Reference

Most of the PouchDB API is exposed as `fun(arg, [options], [callback])` Where both the options and the callback are optional. Callbacks use the `function(err, result)` idiom where the first argument will be undefined unless there is an error, the second argument holds the result.

## Create database<a id="create_database"></a>

{% highlight js %}
new PouchDB([name], [options])
{% endhighlight %}

This method creates a database or opens an existing one. If you use a `http://domain.com/dbname` then PouchDB will work as a client to an online CouchDB instance, otherwise it will create a local database using a backend that is present.

**Note:** If you are also using indexedDB directly, PouchDB will use `_pouch_` to prefix the internal database names, dont manually create databases with the same prefix.

* `options.name`: You can omit the name argument and specify it via options.
* `options.auto_compaction`: This turns on auto compaction (experimental).

#### Example Usage:
{% highlight js %}
var db = new PouchDB('dbname');
// or
var db = new PouchDB('http://localhost:5984/dbname');
{% endhighlight %}

## Delete database<a id="delete_database"></a>

{% highlight js %}
PouchDB.destroy(name, [callback])
{% endhighlight %}

Delete database with given name

#### Example Usage:
{% highlight js %}
PouchDB.destroy('dbname', function(err, info) { });
{% endhighlight %}

## Create / Update a document<a id="create_document"></a>

{% highlight js %}
db.put(doc, [options], [callback])
{% endhighlight %}

Create a new document or update an existing document. If the document already exists
you must specify its revision `_rev`, otherwise a conflict will occur.

There are some restrictions on valid property names of the documents, these are explained [here](http://wiki.apache.org/couchdb/HTTP_Document_API#Special_Fields).

#### Example Usage:
{% highlight js %}
db.put({
  _id: 'mydoc',
  title: 'Heroes'
}, function(err, response) { });

db.put({
  _id: 'mydoc',
  _rev: '1-A6157A5EA545C99B00FF904EEF05FD9F',
  title: 'Lets Dance',
}, function(err, response) { })
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "ok": true,
  "id": "mydoc",
  "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
}
{% endhighlight %}

## Fetch document<a id="fetch_document"></a>

{% highlight js %}
db.get(docid, [options], [callback])
{% endhighlight %}

Retrieves a document, specified by `docid`.

* `options.rev`: Fetch specific revision of a document. Defaults to winning revision (see [couchdb guide](http://guide.couchdb.org/draft/conflicts.html).
* `options.revs`: Include revision history of the document
* `options.revs_info`: Include a list of revisions of the document, and their availability.
* `options.open_revs`: Fetch all leaf revisions if open_revs="all" or fetch all leaf revisions specified in open_revs array. Leaves will be returned in the same order as specified in input array
* `options.conflicts`: If specified conflicting leaf revisions will be attached in `_conflicts` array
* `options.attachments`: Include attachment data
* `options.local_seq`: Include sequence number of the revision in the database

<span></span>

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

## Delete document<a id="delete_document"></a>

{% highlight js %}
db.remove(doc, [options], [callback])
{% endhighlight %}

Delete a document, `doc` is required to be a document with at least an `_id` and a `_rev` property, sending the full document will work.

#### Example Usage:
{% highlight js %}
db.get('mydoc', function(err, doc) {
  db.remove(doc, function(err, response) { });
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

## Create a batch of documents<a id="batch_create"></a>

{% highlight js %}
db.bulkDocs(docs, [options], [callback])
{% endhighlight %}

Modify, create or delete multiple documents. The docs argument is an object with property `docs` which is an array of documents. You can also specify a `new_edits` property on the `docs` object that when set to `false` allows you to post [existing documents](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API#Posting_Existing_Revisions).

If you omit an `_id` parameter on a given document, the database will create a new document and assign an ID for you. To update a document you must include both an `_id` parameter and a `_rev` parameter, which should match the ID and revision of the document on which to base your updates. Finally, to delete a document, include a `_deleted` parameter with the value `true`.

#### Example Usage:
{% highlight js %}
db.bulkDocs({docs: [{title: 'Lisa Says'}]}, function(err, response) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
[{
  "ok": true,
  "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
  "rev": "1-A8BC08745E62E58830CA066D99E5F457"
}]
{% endhighlight %}


## Fetch documents<a id="batch_fetch"></a>

{% highlight js %}
db.allDocs([options], [callback])
{% endhighlight %}

Fetch multiple documents, deleted document are only included if `options.keys` is specified.

* `options.include_docs`: Include the document in each row in the `doc` field
    - `options.conflicts`: Include conflicts in the `_conflicts` field of a doc
* `options.startkey` & `options.endkey`: Get documents with keys in a certain range
* `options.descending`: Reverse the order of the output table
* `options.keys`: array of keys you want to get
    - neither `startkey` nor `endkey` can be specified with this option
    - the rows are returned in the same order as the supplied "keys" array
    - the row for a deleted document will have the revision ID of the deletion, and an extra key "deleted":true in the "value" property
    - the row for a nonexistent document will just contain an "error" property with the value "not_found"
* `options.attachments`: Include attachment data

<span></span>

#### Example Usage:
{% highlight js %}
db.allDocs({include_docs: true}, function(err, response) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  "total_rows": 1,
  "rows": [{
    "doc": {
      "_id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      "_rev": "1-5782E71F1E4BF698FA3793D9D5A96393",
      "blog_post": "my blog post"
    },
   "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
   "key": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
   "value": {
    "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
   }
 }]
}
{% endhighlight %}

## Listen to database changes<a id="changes"></a>

{% highlight js %}
db.changes(options)
{% endhighlight %}

A list of changes made to documents in the database, in the order they were made.
If `options.continuous` is set it returns object with one method `cancel` which you call if you don't want to listen to new changes anymore. `opttions.onChange` will be be called for each change that is encountered.

* `options.include_docs`: Include the associated document with each change
* `options.conflicts`: Include conflicts
* `options.descending`: Reverse the order of the output table
* `options.filter`: Reference a filter function from a design document to selectively get updates
* `options.since`: Start the results from the change immediately after the given sequence number
* `options.complete`: Function called when all changes have been processed
* `options.continuous`: Use _longpoll_ feed
* `options.onChange`: Function called on each change after deduplication (only sends the most recent for each document), not called as a callback but called as onChange(change). Use with `continuous` flag. If you want to

#### Example Usage:
{% highlight js %}
var changes = db.changes({
  since: 20,
  continuous: true,
  onChange: function(change) { }
});

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
    "value":"somevalue",
    "_id":"somestuff",
    "_rev":"1-8e6e4c0beac3ec54b27d1df75c7183a8"
  }
}
{% endhighlight %}

#### Example Usage:
{% highlight js %}
db.changes({complete: function(err, response) { }});
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

## Replicate a database<a id="replication"></a>

{% highlight js %}
Pouch.replicate(source, target, [options])
{% endhighlight %}

Replicate data from `source` to `target`, both the `source` and `target` can be strings used to represent a database of a PouchDB object. If `options.continuous` is `true` then this will track future changes and also replicate them.

If you want to sync data in both directions you can call this twice reversing the `source` and `target` arguments.

* `options.filter`: Reference a filter function from a design document to selectively get updates.
* `options.complete`: Function called when all changes have been processed.
* `options.onChange`: Function called on each change processed..
* `options.continuous`: If true starts subscribing to future changes in the `source` database and continue replicating them.

#### Example Usage:
{% highlight js %}
Pouch.replicate('mydb', 'http://localhost:5984/mydb', {
  onChange: onChange,
  complete: onComplete
});;
{% endhighlight %}

There are also shorthands for replication given existing PouchDB objects, these behave the same as `Pouch.replicate()`:

{% highlight js %}
db.replicate.to(remoteDB, [options]);
// or
db.replicate.from(remoteDB, [options]);
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
  'ok': true,
  'docs_read': 2,
  'docs_written': 2,
  'start_time': "Sun Sep 23 2012 08:14:45 GMT-0500 (CDT)",
  'end_time': "Sun Sep 23 2012 08:14:45 GMT-0500 (CDT)"
}
{% endhighlight %}

## Save an attachment<a id="save_attachment"></a>

{% highlight js %}
db.putAttachment(docId, attachmentId, rev, doc, type, [callback]);
{% endhighlight %}

Attaches a binary object to a document, most of PouchDB's API deals with JSON however we often need to store binary data, these are called `attachments` and you can attach any binary data to a document.

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

Within node you must use a Buffer:

{% highlight js %}
var doc = new Buffer("It's a God awful small affair");
{% endhighlight %}

### Save an inline attachment

You can inline attachments inside the document.
In this case the attachment data must be supplied as a base64 encoded string:

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
on the CouchDB Wiki.

## Get an attachment<a id="get_attachment"></a>

{% highlight js %}
db.getAttachment(docId, attachmentId, [opts], [callback])
{% endhighlight %}

Get attachment data.

#### Example Usage:

{% highlight js %}
db.getAttachment('otherdoc', 'text', function(err, res) { });
{% endhighlight %}

In node you get Buffers and Blobs in the browser.

### Inline attachments

You can specify `attachments: true` to most read operations, the attachment data will then be included in the result.

## Delete an attachment<a id="delete_attachment"></a>

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

## Query the database<a id="query_database"></a>

{% highlight js %}
db.query(fun, [options], [callback])
{% endhighlight %}

Retrieve a view, this allows you to perform more complex queries on PouchDB, the [CouchDB documentation for map reduce](http://docs.couchdb.org/en/latest/ddocs.html#view-functions) applies to PouchDB.

* `fun`: Name of a view function or function
* `options.reduce`: Reduce function

#### Example Usage:
{% highlight js %}
function map(doc) {
  if(doc.title) {
    emit(doc.title, null);
  }
}

db.query({map: map}, {reduce: false}, function(err, response) { });
{% endhighlight %}

#### Example Response:
{% highlight js %}
{
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
  }]
}
{% endhighlight %}

## Get database information<a id="database_information"></a>

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

## Compact the database<a id="compaction"></a>

{% highlight js %}
db.compact([opts], [callback])
{% endhighlight %}

Runs compaction of the database. Fires callback when compaction is done. If you use http adapter and have specified callback Pouch will ping the remote database in regular intervals unless the compaction is finished.

* `options.interval`: Number of milliseconds Pouch waits before asking again if compaction is already done. Only for http adapter.

## Document Revisions Diff<a id="revisions_diff"></a>

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

## List all databases<a id="list_databasese"></a>

{% highlight js %}
Pouch.allDbs(callback)
{% endhighlight %}

Retrieves all databases from PouchDB. By default, this feature is turned off and this function will return an empty list.  To enable this feature and obtain a list of all the databases, set `Pouch.enableAllDbs` to true before creating any databases.

#### Example Usage:
{% highlight js %}
Pouch.enableAllDbs = true;
Pouch.allDbs(function(err, response) {});
{% endhighlight %}

#### Example Response:
{% highlight js %}
[
  "testdb"
]
{% endhighlight %}
