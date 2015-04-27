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

In **Firefox**, PouchDB uses IndexedDB. Though Firefox has no upper limit besides disk space, if your application wishes to store more than 50MB locally, Firefox will [ask the user](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) using a non-modal dialog to confirm that this is okay.

**Chrome** also uses IndexedDB, and it determines the amount of storage available on the user&#8217;s hard drive and uses that [to calculate a limit](https://developers.google.com/chrome/whitepapers/storage#temporary).

**Opera 15+** shares a codebase with Chromium/Blink, and behaves similarly.

**Internet Exporer 10+** has a hard 250MB limit, and will prompt the user with a non-modal dialog at 10MB.

**Mobile Safari** on iOS has a hard 50MB limit, whereas **desktop Safari** has no limit. Both will prompt the user with a modal dialog if an application requests more than 5MB of data, at increments of 5MB, 10MB, 50MB, 100MB, etc. Some versions of Safari have a bug where they only let you request additional storage once, so you'll need to request the desired space up-front. PouchDB allows you to do this using [the `size` option](http://pouchdb.com/api.html#create_database).

**Android** works the same as Chrome as of 4.4+ (IndexedDB), while older versions can store up to 200MB (WebSQL). 

In [PhoneGap](http://phonegap.com/)/[Cordova](http://cordova.apache.org/), you can have unlimited data on both iOS and Android by using the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin).

For more information, see [Working with quota on mobile browsers](http://www.html5rocks.com/en/tutorials/offline/quota-research/).

{% include anchor.html class="h3" title="What data types does PouchDB support?" hash="data_types" %}

PouchDB has two types of data: documents and attachments.

#### Documents

As in CouchDB, the documents you store must be serializable as JSON. Modifying the `Object` prototype or storing classes is not supported.

IndexedDB will actually support non-JSON data (e.g. `Date`s aren't stringified), but you should not rely on this, because CouchDB, LevelDB, and Web SQL do not behave the same.

#### Attachments

PouchDB also supports attachments, which are the most efficient way to store binary data. Attachments may either be supplied as base64-encoded strings or as `Blob` objects.

Different backends have different strategies for storing binary data, which may affect the overall database size. Attachment stubs have a `length` property that describes the number of bytes in the `Blob` object, but under the hood, it may actually take up more space than that.

PouchDB's strategies are:

* **Blob**: data is stored in a true binary format. The most efficient method.
* **UTF-16 Blob**: blobs are coerced to UTF-16, so they takes up 2x the normal space.
* **Base-64**: data is stored as a base-64-encoded string. The least efficient method.

Here are the strategies used by various browsers in PouchDB:

<div class="table-responsive">
<table class="table">
<tr>
    <td></td>
	<th><img src="static/img/browser-logos/internet-explorer_32x32.png" alt="IE"/></th>
	<th><img src="static/img/browser-logos/firefox_32x32.png" alt="Firefox"/></th>
	<th><img src="static/img/browser-logos/chrome_32x32.png" alt="Chrome"/></th>
	<th><img src="static/img/browser-logos/chrome_32x32.png" alt="Chrome"/></th>
	<th><img src="static/img/browser-logos/safari_32x32.png" alt="Safari"/></th>
	<th><img src="static/img/browser-logos/safari_32x32.png" alt="Safari"/></th>
</tr>
<tr>
    <th>Adapter</th>
	<th>IE (10+)</th>
	<th>Firefox</th>
	<th>Chrome < 43,<br/>Android</th>
	<th>Chrome >= 43</th>
	<th>Safari < 7.1,<br/>iOS < 8</th>	
	<th>Safari >= 7.1,<br/>iOS >= 8</th>
</tr>
<tr>
    <td>IndexedDB</td>
	<td>Blob</td>
	<td>Blob</td>
	<td>Base-64</td>
	<td>Blob</td>
	<td></td>
	<td></td>
</tr>
<tr>
	<td>WebSQL</td>
	<td></td>
	<td></td>
	<td>Blob</td>
	<td>Blob</td>
	<td>UTF-16 Blob</td>
	<td>Blob</td>
</tr>
</table>
</div>

Attachments are deduplicated based on their MD5 sum, so duplicate attachments won't take up extra space. 

To truly remove an attachment from the data store, you will need to use [compaction](http://pouchdb.com/api.html#compaction) to remove document revisions that reference that attachment. 

{% include anchor.html class="h3" title="Is it safe to upgrade PouchDB?" hash="safe_to_upgrade" %}

Since v1.0.0, PouchDB has supported automatic schema migrations. This means that if you open a database that was built with an older version of PouchDB, the newer version will run all the steps necessary to get the old database up to date. We have extensive tests in place to guarantee that this feature works correctly.

Even in the case of a major version release, PouchDB still performs the schema migrations. So for instance, you can create a database with PouchDB 1.0.0 and it will still work after you open it in 3.0.0.

Once a database is migrated, however, you can no longer open it with an older version of PouchDB. So if an update contains a migration, it will be clearly marked in the release notes.

{% include anchor.html class="h3" title="How is PouchDB different from CouchDB?" hash="couchdb_differences" %}

PouchDB is also a CouchDB client, and you should be able to switch between a local database or an online CouchDB instance without changing any of your application's code.

However, there are some minor differences to note:

**View Collation** - CouchDB uses ICU to order keys in a view query; in PouchDB they are ASCII ordered.

**View Offset** - CouchDB returns an `offset` property in the view results. In PouchDB, `offset` just mirrors the `skip` parameter rather than returning a true offset.
