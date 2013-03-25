---
layout: default
title: PouchDB, the JavaScript Database that Syncs!
---

# API Documentation

Most of the Pouch API is exposed as `fun(arg, [options], [callback])` Where both the options and the callback are optional. Callbacks are in the node.js idiom of `function(err, data)` Where the first argument will be undefined unless there is an error, further arguments specify the result.

### API Methods

* [List all databases](#list_all_databases)
* [Create a database](#create_a_database)
* [Delete a database](#delete_a_database)
* [Create a document](#create_a_document)
* [Update a document](#update_a_document)
* [Save an attachment](#save_an_attachment)
* [Get an attachment](#get_an_attachment)
* [Delete an attachment](#delete_an_attachment)
* [Create a batch of documents](#create_a_batch_of_documents)
* [Fetch a document](#fetch_a_document)
* [Fetch documents](#fetch_documents)
* [Query the database](#query_the_database)
* [Delete a document](#delete_a_document)
* [Get database information](#get_database_information)
* [Listen to database changes](#listen_to_database_changes)
* [Replicate a database](#replicate_a_database)
* [Compact the database](#compact_the_database)
* [Get document revision diffs](#document_revisions_diff)

## List all databases

    Pouch.allDbs(callback)

Retrieves all databases from PouchDB. (Adapter prefix of database is included if it was created with a prefix.)

    Pouch.allDbs(function(err, response) {
        // Response:
        // [
        //    "testdb",
        //    "idb://testdb2"
        // ]
    })

## Create a database

    var pouchdb = Pouch('dbname', [options])
    var pouchdb = Pouch('http://localhost:5984/dbname', [options])

This method gets an existing database if one exists or creates a new one if one does not exist. You may also explicitly specify which backend you want to use for local database (e.g. `idb://dbname` or `leveldb://dbname`) but usually it is convenient to let PouchDB choose the best backend by itself.

    var pouchdb = Pouch('test');

    pouchdb.post(...;

## Delete a database

    Pouch.destroy(name, [callback])

Delete database with given name

    Pouch.destroy('test', function(err, info) {
      // database deleted
    })

## Create a document

    db.post(doc, [options], [callback])

Create a new document. Only use `db.post` if you want PouchDB to generate
an ID for your document, otherwise use `db.put`

    db.post({ title: 'Cony Island Baby' }, function(err, response) {
      // Response:
      // {
      //   "ok": true,
      //   "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      //   "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
      // }
    })

## Update a document

    db.put(doc, [options], [callback])

Create a new document or update an existing document. If the document already exists
you must specify its revision (_rev), otherwise a conflict will occur.

    db.put({ _id: 'mydoc', title: 'Rock and Roll Heart' }, function(err, response) {
      // Response:
      // {
      //   "ok": true,
      //   "id": "mydoc",
      //   "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
      // }
    })

## Save an attachment

     db.putAttachment(id, rev, doc, type, [callback])

Create an attachment in an existing document.

    db.put({ _id: 'otherdoc', title: 'Legendary Hearts' }, function(err, response) {
      var doc = new Blob(['Legendary hearts, tear us all apart\nMake our emotions bleed, crying out in need']);
      db.putAttachment('otherdoc/text', response.rev, doc, 'text/plain', function(err, res) {
        // Response:
        // {
        //   "ok": true,
        //   "id": "otherdoc",
        //   "rev": "2-068E73F5B44FEC987B51354DFC772891"
        // }
      })
    })

Within node you must use a Buffer:

      var doc = new Buffer('Legendary hearts, tear us all apart\nMake our emotions bleed, crying out in need');


### Save an inline attachment

You can inline attachments inside the document.
In this case the attachment data must be supplied as a base64 encoded string:

    {
      "_id": "otherdoc",
      "title": "Legendary Hearts",
      "_attachments": {
        "text": {
          "content_type": "text/plain",
          "data": "TGVnZW5kYXJ5IGhlYXJ0cywgdGVhciB1cyBhbGwgYXBhcnQKTWFrZSBvdXIgZW1vdGlvbnMgYmxlZWQsIGNyeWluZyBvdXQgaW4gbmVlZA=="
        }
      }
    }

See [Inline Attachments](http://wiki.apache.org/couchdb/HTTP_Document_API#Inline_Attachments)
on the CouchDB Wiki.

## Get an attachment

     db.getAttachment(id, [callback])

Get attachment data.

    db.getAttachment('otherdoc/text', function(err, res) {
      // Response:
      // Blob or Buffer
    })

In node you get Buffers and Blobs in the browser.

### Inline attachments

You can specify `attachments: true` in most get operations.
The attachment data will then be included in the attachment stubs.


## Delete an attachment

     db.removeAttachment(id, rev, [callback])

Delete an attachment from a doc.

    db.removeAttachment('otherdoc/text', '2-068E73F5B44FEC987B51354DFC772891', function(err, res) {
      // Response:
      // {
      //   "ok": true,
      //   "rev": "3-1F983211AB87EFCCC980974DFC27382F"
      // }
    })


## Create a batch of documents

    db.bulkDocs(docs, [options], [callback])

Modify, create or delete multiple documents. If you omit an `_id` parameter on
a given document, the database will create a new document and assign an ID for you.
To update a document you must include both an `_id` parameter and a `_rev` parameter,
which should match the ID and revision of the document on which to base your updates. Finally, to delete
a document, include a `_deleted` parameter with the value `true`.

* `options.new_edits`: Prevent the database from assigning new revision IDs to the documents.

<span></span>

    db.bulkDocs({ docs: [{ title: 'Lisa Says' }] }, function(err, response) {
      // Response array:
      // [
      //   {
      //     "ok": true,
      //     "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //     "rev": "1-A8BC08745E62E58830CA066D99E5F457"
      //   }
      // ]
    })

## Fetch a document

    db.get(docid, [options], [callback])

Getrieves a document, specified by `docid`.

* `options.revs`: Include revision history of the document
* `options.revs_info`: Include a list of revisions of the document, and their availability.
* `options.attachments`: Include attachment data

<span></span>

    db.bulkDocs({ docs: [{ title: 'Lisa Says' }] }, function(err, response) {
      // Response array:
      // [
      //   {
      //     "ok": true,
      //     "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //     "rev": "1-A8BC08745E62E58830CA066D99E5F457"
      //   }
      // ]
    })

    db.get('mydoc', function(err, doc) {
      // Document:
      // {
      //   "title": "Rock and Roll Heart",
      //   "_id": "mydoc",
      //   "_rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
      // }
    })

## Fetch documents

    db.allDocs([options], [callback])

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

    db.allDocs({include_docs: true}, function(err, response) {
      // Document rows:
      // {
      //   "total_rows": 4,
      //   "rows": [
      //     {
      //       "doc": {
      //         "_id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      //         "_rev": "1-5782E71F1E4BF698FA3793D9D5A96393",
      //         "blog_post": "my blog post"
      //       },
      //       "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      //       "key": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      //       "value": {
      //         "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
      //       }
      //     },
      //     {
      //       "doc": {
      //         "__id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //         "__rev": "1-A8BC08745E62E58830CA066D99E5F457",
      //         "blog_post": "my second blog post"
      //       },
      //       "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //       "key": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //       "value": {
      //         "rev": "1-A8BC08745E62E58830CA066D99E5F457"
      //       }
      //     },
      //     {
      //       "doc": {
      //         "_id": "mydoc",
      //         "_rev": "1-A6157A5EA545C99B00FF904EEF05FD9F",
      //         "other_field": "some other document"
      //       },
      //       "id": "mydoc",
      //       "key": "mydoc",
      //       "value": {
      //         "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
      //       }
      //     }
      //   ]
      // }
    })

    db.allDocs({keys: ["2", "0", "1000"]}, function(err, response) {
      // {
      //   "total_rows": 4,
      //   "rows": [
      //     {
      //       "id": "2",
      //       "key": "2",
      //       "value": {
      //         "rev": "1-3a0bf449367880a229ea7c61f9394c83"
      //       }
      //     },
      //     {
      //       "id": "0",
      //       "key": "0",
      //       "value": {
      //         "deleted": true
      //         "rev": "1-fb8a93eb436b7e799a7bbc578a08e9a5"
      //       }
      //     },
      //     {
      //       "key": "1000",
      //       "error": "not_found"
      //     }
      //   ]
      // }
    });

## Query the database

    db.query(fun, [options], [callback])

Retrieve a view.

* `fun`: Name of a view function or function
* `options.reduce`: To reduce or not. The default is to reduce if there is a reduce function

<span></span>

    function map(doc) {
      if(doc.title) {
        emit(doc.title, null);
      }
    }

    db.query({map: map}, {reduce: false}, function(err, response) {
      // View rows:
      // {
      //   "rows": [
      //     {
      //       "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      //       "key": "Cony Island Baby",
      //       "value": null
      //     },
      //     {
      //       "id": "otherdoc",
      //       "key": "Legendary Hearts",
      //       "value": null
      //     },
      //     {
      //       "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //       "key": "Lisa Says",
      //       "value": null
      //     },
      //     {
      //       "id": "mydoc",
      //       "key": "Rock and Roll Heart",
      //       "value": null
      //     }
      //   ]
      // }
    })


## Delete a document

    db.remove(doc, [options], [callback])

Delete a document.

    db.get('mydoc', function(err, doc) {
      db.remove(doc, function(err, response) {
        // Response:
        // {
        //   "ok": true,
        //   "id": "mydoc",
        //   "rev": "2-9AF304BE281790604D1D8A4B0F4C9ADB"
        // }
      })
    })


## Get database information

    db.info(callback)

Get information about a database.

    db.info(function(err, info) {
      // Database information:
      // {
      //   "db_name": "test",
      //   "doc_count": 4,
      //   "update_seq": 0
      // }
    })


## Listen to database changes

    db.changes(options)

A list of changes made to documents in the database, in the order they were made.
If `options.continuous` is set it returns object with one method `cancel` which you call if you don't want to listen to new changes anymore.

* `options.include_docs`: Include the associated document with each change
* `options.conflicts`: Include conflicts
* `options.descending`: Reverse the order of the output table
* `options.filter`: Reference a filter function from a design document to selectively get updates
* `options.since`: Start the results from the change immediately after the given sequence number
* `options.complete`: Function called when all changes have been processed
* `options.continuous`: Use _longpoll_ feed
* `options.onChange`: Function called on each change after deduplication (only sends the most recent for each document), not called as a callback but called as onChange(change). Use with `continuous` flag. If you want to

<span></span>

    db.changes({complete: function(err, response) {
      // Changes list:
      // {
      //   "results": [
      //     {
      //       "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
      //       "seq": 1,
      //       "changes": [
      //         {
      //           "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
      //         }
      //       ]
      //     },
      //     {
      //       "id": "mydoc",
      //       "seq": 2,
      //       "changes": [
      //         {
      //           "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
      //         }
      //       ]
      //     },
      //     {
      //       "id": "otherdoc",
      //       "seq": 3,
      //       "changes": [
      //         {
      //           "rev": "1-3753476B70A49EA4D8C9039E7B04254C"
      //         }
      //       ]
      //     },
      //     {
      //       "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
      //       "seq": 4,
      //       "changes": [
      //         {
      //           "rev": "1-A8BC08745E62E58830CA066D99E5F457"
      //         }
      //       ]
      //     }
      //   ]
      // }
    }})


    var changes = db.changes({
      continuous: true,
      onChange: function(change){
      // example change object:
      // {
      //   "id":"somestuff",
      //   "seq":21,
      //   "changes":[
      //     {
      //       "rev":"1-8e6e4c0beac3ec54b27d1df75c7183a8"
      //     }
      //   ],
      //   "doc":{
      //     "value":"somevalue",
      //     "_id":"somestuff",
      //     "_rev":"1-8e6e4c0beac3ec54b27d1df75c7183a8"
      //   }
      //  }
      }
    });
    // changes.cancel() - no longer fire onChange

## Replicate a database

    Pouch.replicate(from, to, [options], [callback])

Replicate one database to another.

* `options.filter`: Reference a filter function from a design document to selectively get updates
* `options.complete`: Function called when all changes have been processed, defaults to the callback
* `options.onChange`: Function called on each change after deduplication (only sends the most recent for each document), not called as a callback but called as onChange(change)

<span></span>

    Pouch.replicate('mydb', 'http://localhost:5984/mydb', function(err, changes) {
      //
    })

## Compact the database

    db.compact([opts], [callback])

Runs compaction of the database. Fires callback when compaction is done. If you use http adapter and have specified callback Pouch will ping the remote database in regular intervals unless the compaction is finished.

* `options.interval`: Number of milliseconds Pouch waits before asking again if compaction is already done. Only for http adapter.

## Document Revisions Diff

    db.revsDiff(diff, [callback])

Given a set of document/revision IDs, returns the subset of those that do not correspond
to revisions stored in the database. Primarily used in replication.

    db.revsDiff({
      myDoc1: [
        "1-b2e54331db828310f3c772d6e042ac9c",
        "2-3a24009a9525bde9e4bfa8a99046b00d"
      ]
    }, function (err, diffs) {
      // Diffs:
      // {
      //   "myDoc1": {
      //     "missing": ["2-3a24009a9525bde9e4bfa8a99046b00d"]
      //   }
      // }
    });
