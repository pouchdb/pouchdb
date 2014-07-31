---
layout: 2ColLeft
title: FAQ
sidebar: nav.html
---

{% include anchor.html class="h3" title="Can PouchDB sync with MongoDB/MySQL/my current non-CouchDB database?" hash="sync_non_couchdb" %}


No, your backend needs to speak the [CouchDB replication protocol](http://couchdb.readthedocs.org/en/latest/replication/protocol.html). The magic of PouchDB <&ndash;> CouchDB sync comes from this design, which in particular requires all documents to be versioned with the `_rev` marker. This allows PouchDB and CouchDB to [elegantly handle conflicts](http://writing.jan.io/2013/12/19/understanding-couchdb-conflicts.html), among other benefits.

{% include anchor.html class="h3" title="What can PouchDB sync with?" hash="what_can_pouchdb_sync_with" %}

There are a number of databases that implement a CouchDB-like protocol, and PouchDB should be able to replicate with them. They include:

 * [CouchDB](http://couchdb.apache.org/) &ndash; CouchDB is our primary reference database and is used for automated testing.
 * [Cloudant](https://cloudant.com/) &ndash; A cluster-aware fork of CouchDB.
 * [Couchbase Sync Gateway](http://www.couchbase.com/communities/couchbase-sync-gateway) &ndash; A sync gateway for Couchbase.
 * [IrisCouch](http://iriscouch.com/) &ndash; CouchDB in the cloud.
 * [PouchDB Server](https://github.com/pouchdb/pouchdb-server) &ndash; An HTTP API written on top of PouchDB. Additionally, it supports alternate backends like in-memory, Redis, Riak and MySQL via [the LevelUP ecosystem](https://github.com/rvagg/node-levelup/wiki/Modules#storage). Note that your application must use the PouchDB API rather than directly modifying the database, however.

{% include anchor.html class="h3" title="The web is nice, but I want to build a native app?" hash="native_support" %}

PouchDB is one of multiple projects that implement the CouchDB protocol, and these can all be used to sync the same set of data.

For desktop applications, you may want to look into embedding CouchDB (or [rcouch](https://github.com/refuge/rcouch)). PouchDB also works great with web-based frameworks like [node-webkit](https://github.com/rogerwang/node-webkit), [Chrome apps](https://developer.chrome.com/apps/about_apps), [Atom Shell](https://github.com/atom/atom-shell) and [WinJS](http://try.buildwinjs.com/#listview).

For mobile applications, you can use PouchDB within [PhoneGap](http://phonegap.com/)/[Cordova](http://cordova.apache.org/) (optionally using the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin)), or there are several native libraries:

**iOS**:

* [Couchbase Lite for iOS](https://github.com/couchbase/couchbase-lite-ios)
* [Cloudant Sync for iOS](https://github.com/cloudant/CDTDatastore)

**Android**:

* [Couchbase Lite for Android](https://github.com/couchbase/couchbase-lite-android)
* [Cloudant Sync for Android](https://github.com/cloudant/sync-android)

{% include anchor.html class="h3" title="How much data can PouchDB store?" hash="data_limits" %}

In **Firefox**, PouchDB uses IndexedDB, which will ask the user if data can be stored the first time it is attempted, then every 50MB after. The amount that can be stored is unlimited.

**Chrome** calculates the amount of available storage on the user's hard drive and [uses that to calculate a limit](https://developers.google.com/chrome/whitepapers/storage#temporary). 

**Opera** should work the same as Chrome, since it's based on Blink.

**Internet Exporer 10+** has a hard 250MB limit.

**Mobile Safari** on iOS has a hard 50MB limit, while **desktop Safari** will prompt users wanting to store more than 5MB up to a limit of 500MB. Some versions of Safari will only let you request additional storage once, but you can get around this using [the `size` option](http://pouchdb.com/api.html#create_database).

**Android** works the same as Chrome as of 4.4+, while older version can store up to 200MB. 

In [PhoneGap](http://phonegap.com/)/[Cordova](http://cordova.apache.org/), you can have unlimited data on both iOS and Android by using the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin).

For more information, see [Working with quota on mobile browsers](http://www.html5rocks.com/en/tutorials/offline/quota-research/).

{% include anchor.html class="h3" title="Is it safe to upgrade PouchDB?" hash="safe_to_upgrade" %}

Since v1.0.0, PouchDB has supported automatic schema migrations. This means that if you open a database that was built with an older version of PouchDB, the newer version will run all the steps necessary to get the old database up to date. We have extensive tests in place to guarantee that this feature works correctly.

Even in the case of a major version release, PouchDB still performs the schema migrations. So for instance, you can create a database with PouchDB 1.0.0 and it will still work after you open it in 3.0.0.

Once a database is migrated, however, you can no longer open it with an older version of PouchDB. So if an update contains a migration, it will be clearly marked in the release notes.

{% include anchor.html class="h3" title="How is PouchDB different from CouchDB?" hash="couchdb_differences" %}

PouchDB is also a CouchDB client, and you should be able to switch between a local database or an online CouchDB instance without changing any of your application's code.

However, there are some minor differences to note:

**View Collation** - CouchDB uses ICU to order keys in a view query; in PouchDB they are ASCII ordered.

**View Offset** - CouchDB returns an `offset` property in the view results. In PouchDB, `offset` just mirrors the `skip` parameter rather than returning a true offset.
