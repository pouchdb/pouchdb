---
layout: learn
title: PouchDB, the JavaScript Database that Syncs!
---

# FAQ


### Can PouchDB sync with MySQL / my current non CouchDB database?

No, the data model of your application has a lot of impact on its ability to sync, relational data with the existence of transactions make this harder. It may be possible given some tradeoffs but right now we are focussing on making PouchDB <-> (PouchDB / CouchDB) sync as reliable and easy to use as possible.

### What can PouchDB sync with?

There are a number of projects that implement a CouchDB like protocol and PouchDB should be able to replicate with them, they include:

 * [PouchDB-Server](https://github.com/nick-thompson/pouchdb-server) - a HTTP api written on top of PouchDB
 * [Cloudant](https://cloudant.com/) - A cluster aware fork of CouchDB

For CORS support PouchDB requires CouchDB > 1.3.0, however if you serve your web application from the same host as CouchDB (either via reverse proxy or CouchApps) then it should work with older versions.

### The web is nice, but I want to build a native app?

PouchDB is one of multiple projects that implement the CouchDB protocol and these can all be used to sync the same set of data. For desktop applications you may want to look into embedding CouchDB (or [rcouch](https://github.com/refuge/rcouch)), for mobile applications you can use PouchDB within [Apache Cordova](http://cordova.apache.org/) or you can look at [Couchbase lite for iOS](https://github.com/couchbase/couchbase-lite-ios) and [Android](https://github.com/couchbase/couchbase-lite-android).

### CouchDB Differences

PouchDB is also a CouchDB client and you should be able to switch between a local database or an online CouchDB instance changing any of your applications code, there are some minor differences to note:

**View Collation** - CouchDB uses ICU to order keys in a view query, in PouchDB they are ASCII ordered.

**View Offset** - CouchDB returns an `offset` property in the view results, PouchDB doesnt.