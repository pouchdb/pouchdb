Tests are passing and this is ready for more usage/feedback. Works with Chrome 11/12 and Firefox 4.

# PouchDB ( Portable CouchDB JavaScript implementation )

PouchDB is a complete implementation of the CouchDB storage and views API that supports peer-to-peer replication with other CouchDB instances. The browser version is written for IndexedDatabase (part of HTML5). An additional implementation is in progress for leveldb.

#### Storage and Consistency

Unlike the other current couch-like browser APIs built on WebStorage (http://dev.w3.org/html5/webstorage/) PouchDB's goal is to maintain the same kinds of consistency guarantees Apache CouchDB provides across concurrent connections across the multiple-tabs a user might be using to concurrently access an PouchDB database. This is something that just isn't possible with the BrowserStorage API previous libraries like BrowserCouch and lawnchair use.

PouchDB also keeps a by-sequence index across the entire database. This means that, just like Apache CouchDB, PouchDB can replicate with other CouchDB instances and provide the same conflict resolution system for eventual consistency across nodes.

#### BrowserCouch

At this time PouchDB is completely independent from BrowserCouch. The main reason is just to keep the code base concise and focused as the IndexedDatabase specification is being flushed out.

After IndexedDatabase is more solidified it's possible that BrowserCouch and PouchDB might merge to provide a simple fallback option for browsers the do not yet support IndexedDatabase.

# API

Most of the Pouch API is exposed as `fun(arg, [options], [callback])` Where both the options and the callback are optional. Callbacks are in the node.js idiom of `function(err, data)` Where the first argument will be undefined unless there is an error, further arguments specify the result.

## pouch.open(name, [options], [callback])

This method gets an existing database if one exists or creates a new one if one does not exist.

<pre>
  pouch.open('test', function(err, db) {
    // Use db to call further functions
  })
</pre>

## pouch.deleteDatabase(name, [callback])

Delete method with given name

## db

The subject of the of pouch.open. This is primary PouchDB API.

### db.get(docid, [options], [callback])

### db.remove(doc, [options], [callback])

### db.post(doc, [options], [callback])

### db.put(doc, [options], [callback])

### db.bulkDocs(docs, [options], [callback])

## db.changes

### db.changes(options)

### db.changes.addListener(listener)

### db.changes.removeListener(listener)



