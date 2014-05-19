---
layout: 2ColLeft
title: Adapters
sidebar: nav.html
---

PouchDB is not a self-contained database &ndash; rather, it is an abstraction layer over various other databases. By default, PouchDB ships with [IndexedDB][] and [WebSQL][] adapters in the browser, and a [LevelDB][] adapter in Node.js.

PouchDB attempts to provide a unified API that "just works" across every browser and JavaScript environment, and in most cases, you can just use the defaults. However, if you're trying to reach the widest possible audience, or if you want the best performance, then you will sometimes want to tinker with the adapter settings.

#### Topics:
* [PouchDB in the browser](#pouchdb_in_the_browser)
* [PouchDB in Node.js](#pouchdb_in_node_js)
* [PouchDB over HTTP](#pouchdb_over_http)
* [More resources](#more_resources)


{% include anchor.html title="PouchDB in the browser" hash="pouchdb_in_the_browser"%}

Persistent storage is still very inconsistent across browsers. Even with the advent of HTML5, browser vendors do not agree on which databases to support, nor do they implement a 100% consistent API even when they implement the "same" database. This situation will probably not change for many years.

In the browser, PouchDB prefers IndexedDB, and falls back to WebSQL if IndexedDB is not available.  As of 2014, the browser support looks like this:

### Desktop

<table class="table table-striped">
<tr>
    <td></td>
	<th><img src="static/img/browser-logos/internet-explorer_32x32.png" alt="IE"/></th>
	<th><img src="static/img/browser-logos/firefox_32x32.png" alt="Firefox"/></th>
	<th><img src="static/img/browser-logos/chrome_32x32.png" alt="Chrome"/></th>
	<th><img src="static/img/browser-logos/safari_32x32.png" alt="Safari"/></th>
	<th><img src="static/img/browser-logos/opera_32x32.png" alt="Opera"/></th>
</tr>
<tr>
    <th>Adapter</th>
	<th>IE</th>
	<th>Firefox</th>
	<th>Chrome</th>
	<th>Safari</th>
	<th>Opera</th>
</tr>
<tr>
    <td>IndexedDB</td>
	<td>&#10003; (10+)</td>
	<td>&#10003;</td>
	<td>&#10003;</td>
	<td></td>
	<td>&#10003;</td>
</tr>
<tr>
	<td>WebSQL</td>
	<td></td>
	<td></td>
	<td>&#10003;</td>
	<td>&#10003;</td>
	<td>&#10003;</td>
</tr>
</table>

### Mobile

<table class="table table-striped">
<tr>
    <th></th>
	<th><img src="static/img/browser-logos/safari-ios_32x32.png" alt="Safari iOS"/></th>
	<th><img src="static/img/browser-logos/opera_32x32.png" alt="Opera"/></th>
	<th><img src="static/img/browser-logos/android_32x32.png" alt="Android"/></th>
	<th><img src="static/img/browser-logos/blackberry_32x32.png" alt="BlackBerry"/></th>
	<th><img src="static/img/browser-logos/opera_32x32.png" alt="Opera"/></th>
	<th><img src="static/img/browser-logos/chrome-android_32x32.png" alt="Chrome for Android"/></th>
	<th><img src="static/img/browser-logos/firefox_32x32.png" alt="Firefox for Android"/></th>
	<th><img src="static/img/browser-logos/internet-explorer-tile_32x32.png" alt="IE"/></th>
</tr>
<tr>
    <th>Adapter</th>
	<th>iOS Safari</th>
	<th>Opera Mini</th>
    <th>Android Browser</th>
	<th>BlackBerry Browser</th>
	<th>Opera Mobile</th>
	<th>Chrome for Android</th>
	<th>Firefox for Android</th>
	<th>IE Mobile</th>
</tr>
<tr>
    <td>IndexedDB</td>
    <td></td> 
    <td></td>
    <td>&#10003; (4.4+)</td>
    <td>&#10003; (10+)</td>
    <td>&#10003; (21+)</td>
    <td>&#10003;</td>
    <td>&#10003;</td>
    <td>&#10003;</td>
<tr>
<tr>
    <td>WebSQL</td>
    <td>&#10003;</td> 
    <td></td>
    <td>&#10003;</td>
    <td>&#10003;</td>
    <td>&#10003;</td>
    <td>&#10003;</td>
    <td></td>
    <td></td>
<tr>
</table>

Obviously it's a patchwork, with IndexedDB largely ruling the desktop, while WebSQL is king on mobile.  But since PouchDB supports both, you can reach the vast majority of modern browsers by just sticking with the default `pouchdb.js` distribution. 

If you're ever curious which adapter is being used in a particular browser, you can use the following method:

```js
var pouch = new PouchDB('myDB');
console.log(pouch.adapter); // prints either 'idb' or 'websql'
```

### Adapter plugins

Starting with PouchDB 2.3.0, we are also offering several plugins that allow PouchDB to use backends other than just IndexedDB and WebSQL.  All of these plugins pass the PouchDB test suite at 100%.

**Downloads:**

* [pouchdb.localstorage-{{ site.version }}.js](https://github.com/daleharvey/pouchdb/releases/download/{{ site.version }}/pouchdb.localstorage-{{ site.version }}.min.js)
* [pouchdb.memory-{{ site.version }}.js](https://github.com/daleharvey/pouchdb/releases/download/{{ site.version }}/pouchdb.memory-{{ site.version }}.min.js)
* [pouchdb.idb-alt-{{ site.version }}.js](https://github.com/daleharvey/pouchdb/releases/download/{{ site.version }}/pouchdb.idb-alt-{{ site.version }}.min.js)

#### LocalStorage plugin

If you need to support even older browsers, such as IE &le; 9.0 and Opera Mini, you can use the `pouchdb.localstorage.js` plugin, which allows PouchDB to fall back to [LocalStorage][] on browsers that don't support either IndexedDB or WebSQL.  Don't forget to also include the [es5-shims][]!

```html
<script src="pouchdb-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql'] -->
<script src="pouchdb.localstorage-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql', 'localstorage'] -->
```

In the above example, calling `new PouchDB('mydb')` will create a `PouchDB` object that prefers to use IndexedDB, falls back to WebSQL if that's unavailable, and then finally falls back to LocalStorage when neither are available.

If you're ever unsure which adapters are being loaded in which order, refer to `PouchDB.preferredAdapters`, which lists the fallback order.  You can also change the order of elements within this list to suit your preferences.

{% include alert_start.html variant="warning"%}
The LocalStorage plugin should be considered experimental, and the underlying structure may change in the future.  Currently it stores all document IDs in memory, which works fine on small databases but may crash on larger databases.  You can follow the <a href='https://github.com/No9/localstorage-down'>localstorage-down</a> project to track our progress.
{% include alert_end.html %}

#### Memory plugin

If you need to support even older browsers, or if you just want a good database for your unit tests, you can use the `pouchdb.memory.js` plugin, which offers a pure in-memory PouchDB:

```html
<script src="pouchdb-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql'] -->
<script src="pouchdb.memory-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql', 'memory'] -->
```

To create the in-memory database, just call:

```js
var pouch = new PouchDB('myDB', {adapter: 'memory'});
```

This pouch will act exactly like a normal one &ndash; replicating, storing attachments, pagination, etc. &ndash; but it will be deleted as soon as the user closes their browser. However, multiple `PouchDB` objects with the same database name will share the same data:

```js
var pouch1 = new PouchDB('myDB', {adapter: 'memory'});
var pouch2 = new PouchDB('myDB', {adapter: 'memory'});

// pouch1 and pouch2 will behave exactly the same and will share data

var pouch3 = new PouchDB('myOtherDB', {adapter: 'memory'});

// pouch3 will have its own data, though
```

#### Alternative IndexedDB adapter

We are currently experimenting with a [LevelDown][]-based IndexedDB adapter (using [level-js][]) which may eventually replace the current IndexedDB adapter.  If you would like to experiment with this, you may use the `pouchdb.idb-alt.js` plugin, which adds an adapter called `'idb-alt'`.

```html
<script src="pouchdb-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql'] -->
<script src="pouchdb.idb-alt-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql', 'idb-alt'] -->
```

This adapter does not currently offer any advantages over the `'idb'` adapter, but PouchDB developers will be interested in testing it.

#### Mixing and matching adapters

Multiple adapter plugins can be included at once in the same HTML page.  Each time a plugin is added, it will simply be appended to the end of the `PouchDB.preferredAdapters`.  For instance, you can use `pouchdb.localstorage.js` at the same time as `pouchdb.memory.js`:

```html
<script src="pouchdb-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql'] -->
<script src="pouchdb.localstorage-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql', 'localstorage'] -->
<script src="pouchdb.memory-XXX.js"></script>
<!-- PouchDB.preferredAdapters is now: ['idb', 'websql', 'localstorage', 'memory'] -->
```

Keep in mind that the `preferredAdapters` list only refers to local adapters, not remote `'http'` or `'https'` adapters, which can still be invoked the old-fashioned way with a URL like `'http://mysite.com:5984/my_couch_database'`.

### SQLite plugin for Cordova/PhoneGap

On Cordova/PhoneGap, it is often much more performant and reliable to use the native SQLite database rather than the WebSQL database.  On Android, for instance, the WebSQL database runs on the main thread, causing the UI to get slow and janky, whereas the native SQLite database runs on a background thread. And on all platforms, it's a good way to avoid [HTML5 storage quotas](http://www.html5rocks.com/en/tutorials/offline/quota-research).

Luckily, there is a [SQLite Plugin][] that accomplishes exactly this.  If you include this plugin in your project, then PouchDB will automatically pick it up based on the `window.sqlitePlugin` object.

However, this only occurs if the adapter is `'websql'`, not `'idb'` (e.g. on Android 4.4+).  To force PouchDB to use the WebSQL adapter, you can do:

```js
var websqlPouch = new PouchDB('myDB', {adapter: 'websql'});
```

Or to simply prefer WebSQL, and fall back to IndexedDB when WebSQL is not available, you can do:

```js
PouchDB.preferredAdapters = ['websql', 'idb'];
var pouch = new PouchDB('myDB');
```

{% include alert_start.html variant="warning"%}
The SQLite plugin does not yet pass our test suite with 100% success.  However, it should work for most basic use cases.  We will update this page when support reaches 100%.
{% include alert_end.html%}

{% include anchor.html title="PouchDB in Node.js" hash="pouchdb_in_node_js"%}

In Node.js, the adapter situation is much simpler than in browsers.  By default, if you create a PouchDB like this one:

```js
var pouch = new PouchDB('./path/to/db');
```

&hellip;then a LevelDB-based database will be created in the directory `./path/to/db`.

Plus, since the LevelDB adapter is based on [LevelDOWN][], you also benefit from the rich ecosystem of LevelDOWN-based adapters. They may be installed using plain old `npm install` and `require()`. Below are a few examples.

#### In-memory

Just as in the browser, you can create a pure in-memory pouch based on [MemDOWN][]:

```
$ npm install memdown
```

then:

```js
var pouch = new PouchDB('myDB', {db: require('memdown')});
```

Notice that in Node.js, we use the key `'db'` instead of `'adapter'`.  In Node.js the adapter is always called `'leveldb'` for historical reasons.

#### Riak-based adapter

This pouch is backed by [RiakDOWN][]:

```
$ npm install riakdown
```

then:

```js
var pouch = new PouchDB('riak://localhost:8087/somebucket', {db: require('riakdown')});
```

#### More LevelDOWN adapters

There are many other LevelDOWN-based plugins &ndash; far too many to list here. You can find a [mostly-complete list on Github](https://github.com/rvagg/node-levelup/wiki/Modules) that includes implementations on top of MySQL, Windows Azure Table Storage, and SQLite.

{% include anchor.html title="PouchDB over HTTP" hash="pouchdb_over_http"%}

In both the browser and in Node.js, PouchDB can also function as a straightforward API on top of any [CouchDB](https://couchdb.apache.org/)-compliant database, such as [IrisCouch](http://www.iriscouch.com/), [Cloudant](https://cloudant.com/), and [Couchbase Sync Gateway](http://docs.couchbase.com/sync-gateway/):

```js
var pouch = new PouchDB('http://my-site.com:5984/my-db');
var securePouch = new PouchDB('https://my-secure-site.com:5984/my-secure-db');
```

However, we do not currently claim to support any database at 100% fidelity except for CouchDB, so your mileage may vary when syncing with the others.  We will add databases to our supported list as we increase our test coverage.

If you are ever unsure what to do, consider replicating from PouchDB to a CouchDB, then from that CouchDB to one of the other servers.

#### PouchDB Server

[PouchDB Server](https://github.com/nick-thompson/pouchdb-server) is a standalone REST server that implements the CouchDB API, while using a LevelDB-based PouchDB under the hood.  Again, this is not an officially supported server, but it's been known to work.

#### PouchDB Express

Similar to the above, [Express PouchDB](https://github.com/nick-thompson/express-pouchdb) is an Express submodule that mimics most of the CouchDB API within your Express application.

{% include anchor.html title="More resources" hash="more_resources"%}

The best place to look for information on which browsers support which databases is [caniuse.com](http://caniuse.com).  You can consult their tables on browser support for various backends:

* [IndexedDB](http://caniuse.com/indexeddb)
* [WebSQL](http://caniuse.com/sql-storage)
* [LocalStorage](http://caniuse.com/namevalue-storage)

Another neat site is [iwantouse.com](http://www.iwanttouse.com/), which can give you a rough estimate of how many users you will be able to support if you use various browser features.



[IndexedDB]: http://www.w3.org/TR/IndexedDB/
[WebSQL]: http://www.w3.org/TR/webdatabase/
[LevelDB]: https://code.google.com/p/leveldb/
[LocalStorage]: https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage
[es5-shims]: https://github.com/es-shims/es5-shim
[sqlite plugin]: https://github.com/brodysoft/Cordova-SQLitePlugin
[leveldown]: https://github.com/rvagg/node-leveldown
[level-js]: https://github.com/maxogden/level.js
[memdown]: https://github.com/rvagg/memdown
[localstorage-down]: https://github.com/No9/localstorage-down
[RiakDOWN]: https://github.com/nlf/riakdown