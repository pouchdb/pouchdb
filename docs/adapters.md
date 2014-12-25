---
layout: 2ColLeft
title: Adapters
sidebar: nav.html
---

PouchDB is not a self-contained database; it is a CouchDB-style abstraction layer over other databases. By default, PouchDB ships with [IndexedDB][] and [WebSQL][] adapters in the browser, and a [LevelDB][] adapter in Node.js.

PouchDB attempts to provide a consistent API that "just works" across every browser and JavaScript environment, and in most cases, you can just use the defaults. However, if you're trying to reach the widest possible audience, or if you want the best performance, then you will sometimes want to tinker with the adapter settings.

#### Topics:
* [PouchDB in the browser](#pouchdb_in_the_browser)
* [PouchDB in Node.js](#pouchdb_in_node_js)
* [PouchDB over HTTP](#pouchdb_over_http)
* [More resources](#more_resources)


{% include anchor.html title="PouchDB in the browser" hash="pouchdb_in_the_browser"%}

In the browser, PouchDB prefers IndexedDB, and falls back to WebSQL if IndexedDB is not available.  As of 2014, the browser support looks like this:

### Desktop

<div class="table-responsive">
<table class="table">
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
</div>

### Mobile

<div class="table-responsive">
<table class="table">
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
</div>

{% include alert_start.html variant="info"%}
Safari 7.1+ and iOS 8+ supposedly support IndexedDB, but their implementation has many bugs, so PouchDB currently ignores it.
{% include alert_end.html%}

If you're ever curious which adapter is being used in a particular browser, you can use the following method:

```js
var pouch = new PouchDB('myDB');
console.log(pouch.adapter); // prints either 'idb' or 'websql'
```


### SQLite plugin for Cordova/PhoneGap

On Cordova/PhoneGap, it is often more performant to use the native SQLite database rather than the WebSQL database.  This is also a good way to avoid [HTML5 storage quotas](http://www.html5rocks.com/en/tutorials/offline/quota-research).

Luckily, there is a [SQLite Plugin][] that accomplishes exactly this.  If you include this plugin in your project, then PouchDB will automatically pick it up based on the `window.sqlitePlugin` object.

However, this only occurs if the adapter is `'websql'`, not `'idb'` (e.g. on Android 4.4+).  To force PouchDB to use the WebSQL adapter, you can do:

```js
var websqlPouch = new PouchDB('myDB', {adapter: 'websql'});
```

The SQLite plugin is known to pass the PouchDB test suite on both iOS and Android. You may run into issues on Windows Phone 8.

### Experimental adapter plugins

PouchDB also offers separate browser plugins that use backends other than IndexedDB and WebSQL. These plugins pass our test suite at 100%, but are not yet part of the official release due to build issues with Browserify. They also add a hefty footprint due to external dependencies, so take them with a grain of salt.

{% include alert_start.html variant="warning"%}
Currently these plugins do not work with Browserify itself; you have to include them as separate scripts in your HTML page.
{% include alert_end.html%}

**Downloads:**

* [pouchdb.localstorage.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.localstorage.js)
* [pouchdb.memory.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.memory.js)
* [pouchdb.idb-alt.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.idb-alt.js)

#### LocalStorage plugin

If you need to support very old browsers, such as IE &le; 9.0 and Opera Mini, you can use the `pouchdb.localstorage.js` plugin, which allows PouchDB to fall back to [LocalStorage][] on browsers that don't support either IndexedDB or WebSQL.  The [es5-shims][] will also be necessary.

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.localstorage.js"></script>
<script>
  // this pouch is backed by LocalStorage
  var pouch = new PouchDB('mydb', {adapter: 'localstorage'});
</script>
```

{% include alert_start.html variant="warning"%}
The LocalStorage plugin should be considered highly experimental, and the underlying structure may change in the future.  Currently it stores all document IDs in memory, which works fine on small databases but may crash on larger databases.  You can follow <a href='https://github.com/No9/localstorage-down'>localstorage-down</a> to track our progress.
{% include alert_end.html %}

#### Memory plugin

If you want a quick database for your unit tests, you can use the `pouchdb.memory.js` plugin, which offers a pure in-memory PouchDB:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.memory.js"></script>
<script>
  // this pouch is ephemeral; it only exists in memory
  var pouch = new PouchDB('mydb', {adapter: 'memory'});
</script>
```

This pouch will act exactly like a normal one &ndash; replicating, storing attachments, pagination, etc. &ndash; but it will be deleted as soon as the user closes their browser. However, multiple `PouchDB` objects with the same database name will share the same data:

```js
// pouch1 and pouch2 will share the same data
var pouch1 = new PouchDB('myDB', {adapter: 'memory'});
var pouch2 = new PouchDB('myDB', {adapter: 'memory'});

// pouch3 will have its own data
var pouch3 = new PouchDB('myOtherDB', {adapter: 'memory'});
```

#### Alternative IndexedDB adapter

We are currently experimenting with a [LevelDown][]-based IndexedDB adapter (using [level-js][]) which may eventually replace the current IndexedDB adapter.  If you would like to experiment with this, you may use the `pouchdb.idb-alt.js` plugin:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.idb-alt.js"></script>
<script>
  // this pouch is backed by IndexedDB but uses
  // a different structure than the main one
  var pouch = new PouchDB('mydb', {adapter: 'idb-alt'});
</script>
```

This adapter does not currently offer any advantages over the `'idb'` adapter, but PouchDB developers will be interested in testing it.

{% include anchor.html title="PouchDB in Node.js" hash="pouchdb_in_node_js"%}

In Node.js, the adapter situation is much simpler than in browsers.  By default, if you create a PouchDB like this one:

```js
var pouch = new PouchDB('./path/to/db');
```

then a LevelDB-based database will be created in the directory `./path/to/db`.

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


{% include alert_start.html variant="warning"%}
We do not currently test against any LevelDOWN adapters other than LevelDB and MemDOWN, so the other backends should be considered experimental.
{% include alert_end.html%}

{% include anchor.html title="PouchDB over HTTP" hash="pouchdb_over_http"%}

In both the browser and in Node.js, PouchDB can also function as a straightforward API on top of any [CouchDB](https://couchdb.apache.org/)-compliant database, such as [IrisCouch](http://www.iriscouch.com/), [Cloudant](https://cloudant.com/), and [Couchbase Sync Gateway](http://docs.couchbase.com/sync-gateway/):

```js
var pouch = new PouchDB('http://my-site.com:5984/my-db');
var securePouch = new PouchDB('https://my-secure-site.com:5984/my-secure-db');
```

However, we do not currently claim to support any database at 100% fidelity except for CouchDB, so your mileage may vary when syncing with the others.  We will add databases to our supported list as we increase our test coverage.

If you are ever unsure what to do, consider replicating from PouchDB to a CouchDB, then from that CouchDB to one of the other servers.



#### PouchDB Server

[PouchDB Server](https://github.com/pouchdb/pouchdb-server) is a standalone REST server that implements the CouchDB API, while using a LevelDB-based PouchDB under the hood.  PouchDB Server passes our unit test suite at 100%, but be aware that it is not as full-featured or battle-tested as CouchDB.

#### PouchDB Express

The underlying module for PouchDB Server, [Express PouchDB](https://github.com/pouchdb/express-pouchdb) is an Express submodule that mimics most of the CouchDB API within your Express application.

{% include anchor.html title="More resources" hash="more_resources"%}

The best place to look for information on which browsers support which databases is [caniuse.com](http://caniuse.com).  You can consult their tables on browser support for various backends:

* [IndexedDB](http://caniuse.com/indexeddb)
* [WebSQL](http://caniuse.com/sql-storage)
* [LocalStorage](http://caniuse.com/namevalue-storage)

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
