---
layout: 2ColLeft
title: FAQ
sidebar: nav.html
---

### Can PouchDB sync with MySQL / my current non CouchDB database?

No, the data model of your application has a lot of impact on its ability to sync, relational data with the existence of transactions make this harder. It may be possible given some tradeoffs but right now we are focussing on making PouchDB <-> (PouchDB / CouchDB) sync as reliable and easy to use as possible.

### What can PouchDB sync with?

There are a number of projects that implement a CouchDB like protocol and PouchDB should be able to replicate with them, they include:

 * [PouchDB-Server](https://github.com/nick-thompson/pouchdb-server) - a HTTP api written on top of PouchDB
 * [Cloudant](https://cloudant.com/) - A cluster aware fork of CouchDB
 * [Couchbase Sync Gateway](http://www.couchbase.com/communities/couchbase-sync-gateway) - A sync gateway for Couchbase

### The web is nice, but I want to build a native app?

PouchDB is one of multiple projects that implement the CouchDB protocol and these can all be used to sync the same set of data. For desktop applications you may want to look into embedding CouchDB (or [rcouch](https://github.com/refuge/rcouch)), for mobile applications you can use PouchDB within [Apache Cordova](http://cordova.apache.org/) or you can look at [Couchbase lite for iOS](https://github.com/couchbase/couchbase-lite-ios) and [Android](https://github.com/couchbase/couchbase-lite-android).

### Browsers have storage limitations, how much data can PouchDB store?

In Firefox PouchDB uses IndexedDB, this will ask the user if data can be stored the first it is attempted then every 50MB after, the amount that can be stored is not limited.

Chrome calculates the amount of storage left available on the users hard drive and uses [that to calculate a limit](https://developers.google.com/chrome/whitepapers/storage#temporary).

Mobile Safari on iOS has a hard 50MB limit, desktop Safari will prompt users wanting to store more than 5MB up to a limit of 500MB.

Opera has no known limit.

Internet Exporer 10 has a hard 250MB limit.

### CouchDB Differences

PouchDB is also a CouchDB client and you should be able to switch between a local database or an online CouchDB instance changing any of your applications code, there are some minor differences to note:

**View Collation** - CouchDB uses ICU to order keys in a view query, in PouchDB they are ASCII ordered.

**View Offset** - CouchDB returns an `offset` property in the view results, PouchDB doesnt.
