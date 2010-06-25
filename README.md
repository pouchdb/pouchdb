Don't use this, it is definitely not working yet and this API hasn't shipped in a single browser yet.

I'll try to keep this link to the most recent experimental Firefox build with IDB support up to date:

http://ftp.mozilla.org/pub/mozilla.org/firefox/tryserver-builds/sdwilsh@shawnwilsher.com-44f33414d557/

# IDBCouch ( CouchDB in the Browser )

IDBCouch is a complete implementation of the CouchDB storage and views API that supports peer-to-peer replication with other CouchDB instances. It is built on top of IndexedDatabase which is a specification that is still in flux as Mozilla implements the draft for Firefox 4.

#### Storage and Consistency

Unlike the other current couch-like browser APIs built on WebStorage (http://dev.w3.org/html5/webstorage/) IDBCouch's goal is to maintain the same kinds of consistency guarantees Apache CouchDB provides across concurrent connections across the multiple-tabs a user might be using to concurrently access an IDBCouch database. This is something that just isn't possible with the BrowserStorage API previous libraries liskt BrowserCouch and lawnchair use.

IDBCouch also keeps a by-sequence index across the entire database. This means that, just like Apache CouchDB, IDBCouch can replicate with other CouchDB instances and provide the same conflict resolution system for eventual consistency across nodes.

#### BrowserCouch

At this time IDBCouch is completely independent from BrowserCouch. The main reason is just to keep the code base concise and focused as the IndexedDatabase specification is being flushed out.

After IndexedDatabase is more solidified it's possible that BrowserCouch and IDBCouch might merge to provide a simple fallback option for browsers the do not yet support IndexedDatabase.

# API

## createCouch(options[, callback])

This method gets an existing database if one exists or creates a new one if one does not exist.

The first argument is an options object. The only required option is `name`, all others are optional. The second argument an optional success callback.

* `'name'` - The name of the IDBCouch you would like to get/create.
* `'description'` - A description of the database. If one is not set then IDBCouch will generate one since it is required by the IndexedDatabase API.
* '`success'` - A callback function taking one argument, the IDBCouch database. The second argument to `createCouch` will be used if passed.
* '`error'` - An error handler callback taking one argument, the error.

<pre>
  createCouch({name:'test'}, function (couch) {
    // Use my CouchDB
  })
</pre>

## couch

The subject of the of createCouch success callback. This is primary IDBCouch API.

### couch.get(docid, options)

### couch.remove(doc, options)

### couch.post(doc, options)

### couch.changes

### couch.changes(options)

### couch.changes.addListener(listener)

### couch.changes.removeListener(listener)

### couch.bulk(docs, options)


