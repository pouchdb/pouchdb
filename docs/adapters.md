---
layout: 2ColLeft
title: Adapters
sidebar: nav.html
---

PouchDB is not a self-contained database; it is a CouchDB-style abstraction layer over other databases. By default, PouchDB ships with [IndexedDB][] and [WebSQL][] adapters in the browser, and a [LevelDB][] adapter in Node.js. This can be visualized as so:

<object data="static/svg/pouchdb_adapters.svg" type="image/svg+xml">
    <img src="static/img/pouchdb_adapters.png" alt="adapters">
</object>

PouchDB attempts to provide a consistent API that "just works" across every browser and JavaScript environment, and in most cases, you can just use the defaults. However, if you're trying to reach the widest possible audience, or if you want the best performance, then you will sometimes want to tinker with the adapter settings.

#### Topics:
* [PouchDB in the browser](#pouchdb_in_the_browser)
* [PouchDB in Node.js](#pouchdb_in_node_js)
* [PouchDB over HTTP](#pouchdb_over_http)
* [More resources](#more_resources)


{% include anchor.html title="PouchDB in the browser" hash="pouchdb_in_the_browser"%}

In the browser, PouchDB prefers IndexedDB, and falls back to WebSQL if IndexedDB is not available.  As of 2015, the browser support looks like this:

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

{% include alert/start.html variant="info"%}
Safari 7.1+ and iOS 8+ supposedly support IndexedDB, but their implementation has many bugs, so PouchDB currently ignores it.
{% include alert/end.html%}

If you're ever curious which adapter is being used in a particular browser, you can use the following method:

```js
var pouch = new PouchDB('myDB');
console.log(pouch.adapter); // prints either 'idb' or 'websql'
```

### SQLite plugin for Cordova/PhoneGap

On Cordova/PhoneGap/Ionic, the native SQLite database is often a popular choice, because it allows unlimited storage (compared to [IndexedDB/WebSQL storage limits](http://www.html5rocks.com/en/tutorials/offline/quota-research)). It also offers more flexibility in backing up and pre-loading databases, because the SQLite files are directly accessible to app developers.

There are various Cordova plugins that can provide access to native SQLite, such as 
[Cordova-sqlite-storage](https://github.com/litehelpers/Cordova-sqlite-storage),    
[cordova-plugin-sqlite-2](https://github.com/nolanlawson/cordova-plugin-sqlite-2), or 
[cordova-plugin-websql](https://github.com/Microsoft/cordova-plugin-websql).

To use them, you must install them separately into your Cordova application, and then add a special third-party PouchDB adapter
called [pouchdb-adapter-cordova-sqlite](https://github.com/nolanlawson/pouchdb-adapter-cordova-sqlite). Once you do
that, you can use it via:

```js
var db = new PouchDB('myDB.db', {adapter: 'cordova-sqlite'});
```

{% include alert/start.html variant="info"%}
In PouchDB pre-6.0.0, Cordova SQLite support was available out-of-the-box, but it has been moved to a separate plugin
to reduce confusion and to make it explicit whether you are using WebSQL or Cordova SQLite.
{% include alert/end.html%}

We recommend avoiding Cordova SQLite unless you are hitting the 50MB storage limit in iOS, you 
require native or preloaded access to the database files, or there's some other reason to go native.
The built-in IndexedDB and WebSQL adapters are nearly always more performant and stable.

{% include alert/end.html%}

### Browser adapter plugins

PouchDB also offers separate browser plugins that use backends other than IndexedDB and WebSQL. These plugins fully pass the PouchDB test suite and are rigorously tested in our CI process.

**Downloads:**

* [pouchdb.memory.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.memory.js) (Minified: [pouchdb.memory.min.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.memory.min.js))
* [pouchdb.localstorage.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.localstorage.js) (Minified: [pouchdb.localstorage.min.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.localstorage.min.js))
* [pouchdb.fruitdown.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.fruitdown.js) (Minified: [pouchdb.fruitdown.min.js](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.fruitdown.min.js))

{% include alert/start.html variant="warning"%}
{% markdown %}
These plugins add a hefty footprint due to external dependencies, so take them with a grain of salt.
{% endmarkdown %}
{% include alert/end.html%}

#### In-memory adapter

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

#### LocalStorage adapter

If you need to support very old browsers, such as IE &le; 9.0 and Opera Mini, you can use the `pouchdb.localstorage.js` plugin, which allows PouchDB to fall back to [LocalStorage][] on browsers that don't support either IndexedDB or WebSQL.  The [es5-shims][] will also be necessary.

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.localstorage.js"></script>
<script>
  // this pouch is backed by LocalStorage
  var pouch = new PouchDB('mydb', {adapter: 'localstorage'});
</script>
```

{% include alert/start.html variant="warning"%}
The LocalStorage plugin should be considered highly experimental, and the underlying structure may change in the future.  Currently it stores all document IDs in memory, which works fine on small databases but may crash on larger databases.  You can follow <a href='https://github.com/No9/localstorage-down'>localstorage-down</a> to track our progress.
{% include alert/end.html %}

#### FruitDOWN adapter

If you need to support IndexedDB in Apple browsers (which PouchDB normally does not support due to instability), then you can use FruitDOWN, which works over all IndexedDB implementations at the expense of using a much smaller part of the IndexedDB API and therefore being slower and less efficient.

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.fruitdown.js"></script>
<script>
  // this pouch is backed by FruitDOWN
  var pouch = new PouchDB('mydb', {adapter: 'fruitdown'});
</script>
```

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

There are many other LevelDOWN-based plugins &ndash; far too many to list here. You can find a [mostly-complete list on Github](https://github.com/rvagg/node-levelup/wiki/Modules#storage-back-ends) that includes implementations on top of MySQL, Windows Azure Table Storage, and SQLite.

#### node-websql adapter

In addition to the LevelDOWN-based adapters, you can also use PouchDB over
[SQLite3](https://github.com/mapbox/node-sqlite3) in Node, using the WebSQL adapter and
[node-websql](https://github.com/nolanlawson/node-websql):

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-adapter-node-websql'));

var db = new PouchDB('mydatabase.db', {adapter: 'websql'});
```

This should be more efficient than something like [sqldown](https://github.com/calvinmetcalf/SQLdown), because
instead of using a LevelDB-esque adapter over SQLite, PouchDB is directly using
SQLite queries to build the database.


{% include alert/start.html variant="warning"%}
We do not currently test against any LevelDOWN adapters other than LevelDB and MemDOWN, so the other backends should be considered experimental.
{% include alert/end.html%}

{% include anchor.html title="PouchDB over HTTP" hash="pouchdb_over_http"%}

In both the browser and in Node.js, PouchDB can also function as a straightforward API on top of any [CouchDB](https://couchdb.apache.org/)-compliant database:

```js
var pouch = new PouchDB('http://my-site.com:5984/my-db');
var securePouch = new PouchDB('https://my-secure-site.com:5984/my-secure-db');
```

You can also sync to and from these databases to your local PouchDB.

Currently PouchDB has full support for:

* CouchDB 1.x ([tested in CI](https://travis-ci.org/pouchdb/pouchdb))
* [Smileupps](https://www.smileupps.com/) (same as 1.x)
* CouchDB 2.x ([tested in CI](https://travis-ci.org/pouchdb/pouchdb))
* [Cloudant](https://cloudant.com/) (roughly the same as 2.x)
* [PouchDB Server](https://github.com/pouchdb/pouchdb-server) ([tested in CI](https://travis-ci.org/pouchdb/pouchdb))
* [PouchDB Server --in-memory mode](https://github.com/pouchdb/pouchdb-server) ([tested in CI](https://travis-ci.org/pouchdb/pouchdb))

[Couchbase Sync Gateway](http://docs.couchbase.com/sync-gateway/) support is [in progress](https://github.com/pouchdb/pouchdb/pull/3521). It will work, but you may run into issues, especially with [attachments](https://github.com/pouchdb/pouchdb/issues/2832). [Drupal 8](http://wearepropeople.com/blog/a-content-staging-solution-for-drupal-8-and-more) has also announced support for PouchDB, and there is [rcouch](https://github.com/rcouch/rcouch) as well, but these are both untested by PouchDB.

If you are ever unsure about a server, consider replicating from PouchDB to CouchDB, then from that CouchDB to the other server.

#### PouchDB Server

[PouchDB Server](https://github.com/pouchdb/pouchdb-server) is a standalone REST server that implements the CouchDB API, while using a LevelDB-based PouchDB under the hood. It also supports an `--in-memory` mode and any [LevelDOWN][] adapter, which you may find handy.

PouchDB Server passes the PouchDB test suite at 100%, but be aware that it is not as full-featured or battle-tested as CouchDB.

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
[sqlite plugin 2]: https://github.com/nolanlawson/cordova-plugin-sqlite-2
[leveldown]: https://github.com/rvagg/node-leveldown
[level-js]: https://github.com/maxogden/level.js
[memdown]: https://github.com/rvagg/memdown
[localstorage-down]: https://github.com/No9/localstorage-down
[RiakDOWN]: https://github.com/nlf/riakdown
