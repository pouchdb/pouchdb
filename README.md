Tests are passing and this is ready for more usage/feedback. Works with Chrome 11/12 and Firefox 4.

# PouchDB ( Portable CouchDB JavaScript implementation )

PouchDB is a complete implementation of the CouchDB storage and views API that supports peer-to-peer replication with other CouchDB instances. The browser version is written for IndexedDatabase (part of HTML5). An additional implementation is in progress for leveldb.

#### Storage and Consistency

Unlike the other current couch-like browser APIs built on WebStorage (http://dev.w3.org/html5/webstorage/) PouchDB's goal is to maintain the same kinds of consistency guarantees Apache CouchDB provides across concurrent connections across the multiple-tabs a user might be using to concurrently access an PouchDB database. This is something that just isn't possible with the BrowserStorage API previous libraries like BrowserCouch and lawnchair use.

PouchDB also keeps a by-sequence index across the entire database. This means that, just like Apache CouchDB, PouchDB can replicate with other CouchDB instances and provide the same conflict resolution system for eventual consistency across nodes.

#### BrowserCouch

At this time PouchDB is completely independent from BrowserCouch. The main reason is just to keep the code base concise and focused as the IndexedDatabase specification is being flushed out.

After IndexedDatabase is more solidified it's possible that BrowserCouch and PouchDB might merge to provide a simple fallback option for browsers the do not yet support IndexedDatabase.

# Getting started

Running `$ make` or `$ make min` in the project will give you a `pouch.alpha.js` or `pouch.alpha.min.js` which you can simple include on the page:

    <script type="text/javascript" src="../pouch.alpha.min.js"></script>

# API

Most of the Pouch API is exposed as `fun(arg, [options], [callback])` Where both the options and the callback are optional. Callbacks are in the node.js idiom of `function(err, data)` Where the first argument will be undefined unless there is an error, further arguments specify the result.

## new Pouch('idb://dbname', [options], [callback])

This method gets an existing database if one exists or creates a new one if one does not exist. The protocol field denotes which backend you want to use (currently only http and indexeddb are supported)

<pre>
new Pouch('idb://test', function(err, db) {
  // Use db to call further functions
})
</pre>

## db

The subject of the of pouch.open. This is primary PouchDB API.

### db.post(doc, [options], [callback])

Create a new document.

<pre>
db.post({ title: 'Cony Island Baby' }, function(err, response) {
  // Response:
  // {
  //   "ok": true,
  //   "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
  //   "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
  // }
})
</pre>


### db.put(doc, [options], [callback])

Create a new document or update an existing document.

<pre>
db.put({ _id: 'mydoc', title: 'Rock and Roll Heart' }, function(err, response) {
  // Response:
  // {
  //   "ok": true,
  //   "id": "mydoc",
  //   "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
  // }
})
</pre>


### db.get(docid, [options], [callback])

Getrieves a document, specified by `docid`.

* `options.revs`: Include revision history of the document
* `options.revs_info`: Include a list of revisions of the document, and their availability

<pre>
db.get('mydoc', function(err, doc) {
  // Document:
  // {
  //   "title": "Rock and Roll Heart",
  //   "_id": "mydoc",
  //   "_rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
  // }
})
</pre>


### db.putAttachment(id, rev, doc, type, [callback])

Create an attachment in an existing document.

<pre>
db.put({ _id: 'otherdoc', title: 'Legendary Hearts' }, function(err, response) {
  var doc = 'Legendary hearts, tear us all apart\nMake our emotions bleed, crying out in need';
  db.putAttachment('otherdoc/text', response.rev, doc, 'text/plain', function(err, res) {
    // Response:
    // {
    //   "ok": true,
    //   "id": "otherdoc",
    //   "rev": "2-068E73F5B44FEC987B51354DFC772891"
    // }
  })
})
</pre>


### db.bulkDocs(docs, [options], [callback])

Modify multiple documents.

<pre>
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
</pre>


### db.allDocs([options], [callback])

Fetch multiple documents.

* `include_docs`: Include the associated document with each change
* `conflicts`: Include conflicts
* `startkey` & `endkey`: Get documents with keys in a certain range
* `descending`: Reverse the order of the output table

<pre>
db.allDocs(function(err, response) {
  // Document rows:
  // {
  //   "total_rows": 4,
  //   "rows": [
  //     {
  //       "id": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
  //       "key": "0B3358C1-BA4B-4186-8795-9024203EB7DD",
  //       "value": {
  //         "rev": "1-5782E71F1E4BF698FA3793D9D5A96393"
  //       }
  //     },
  //     {
  //       "id": "828124B9-3973-4AF3-9DFD-A94CE4544005",
  //       "key": "828124B9-3973-4AF3-9DFD-A94CE4544005",
  //       "value": {
  //         "rev": "1-A8BC08745E62E58830CA066D99E5F457"
  //       }
  //     },
  //     {
  //       "id": "mydoc",
  //       "key": "mydoc",
  //       "value": {
  //         "rev": "1-A6157A5EA545C99B00FF904EEF05FD9F"
  //       }
  //     },
  //     {
  //       "id": "otherdoc",
  //       "key": "otherdoc",
  //       "value": {
  //         "rev": "1-3753476B70A49EA4D8C9039E7B04254C"
  //       }
  //     }
  //   ]
  // }
})
</pre>


### db.query(fun, [options], [callback])

Retrieve a view.

* `fun`: Name of a view function or function
* `options.reduce`: To reduce or not. The default is to reduce if there is a reduce function

<pre>
db.query({ map: function(doc) { if(doc.title) emit(doc.title, null) } }, { reduce: false }, function(err, response) {
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
</pre>


### db.remove(doc, [options], [callback])

Delete a document.

<pre>
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
</pre>


### db.info(callback)

Get information about a database.

<pre>
db.info(function(err, info) {
  // Database information:
  // {
  //   "db_name": "test",
  //   "doc_count": 4,
  //   "update_seq": 0
  // }
})
</pre>


### db.changes(options)

A list of changes made to documents in the database, in the order they were made.

* `include_docs`: Include the associated document with each change
* `continuous`: Use _longpoll_ feed
* `conflicts`: Include conflicts
* `descending`: Reverse the order of the output table
* `filter`: Reference a filter function from a design document to selectively get updates
* `since`: Start the results from the change immediately after the given sequence number

<pre>
db.changes(function(err, response) {
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
})
</pre>


### db.changes.addListener(listener)

Register `listener` function for the changes feed.

### db.changes.removeListener(listener)

## Pouch.destroy(name, [callback])

Delete database with given name

<pre>
Pouch.destroy('idb://test', function(err, info) {
  // database deleted
})
</pre>


## Pouch.replicate(from, to, [callback])

Replicate a database

<pre>
db.replicate('idb://mydb', 'http://localhost:5984/mydb', function(err, changes) {
  //
})
</pre>

## Running the tests

To run the full test suite (including replication) you'll need to run a CORS proxy
pointing to a local CouchDB.

    git clone https://github.com/daleharvey/CORS-Proxy.git
    cd CORS-Proxy
    node server.js

This will proxy requests to http://localhost:1234 (made by the test suite) to
your local CouchDB running on http://localhost:5984, adding the correct CORS
headers so the browser allows the requests to go through.

Next, just run a local CouchDB instance on http://localhost:5984 and make sure it's in
admin party mode. The test suite should now run to completion.
