---
layout: 2ColLeft
title: Custom Builds
sidebar: nav.html
---

PouchDB supports custom builds, meaning you can pick and choose the features of
PouchDB that you want to use, potentially resulting in smaller bundle sizes
and faster build times.

PouchDB exposes its custom builds via separate packages available on npm. All of
these packages follow the format `pouchdb-<name>` and can be installed using `npm install`.

Some packages are included by default in the main `pouchdb` package, whereas 
others (including third-party packages) must be installed separately.

{% include alert/start.html variant="warning"%}
{% markdown %}

Custom builds require an [npm][]-based build system, using a bundler
like [Browserify][], [Webpack][], [SystemJS][], [Rollup][], or [JSPM][]. Tools like
[Bower][], as well as direct download of prebuilt JavaScript files, are not supported.

[Browserify]: http://browserify.org/
[Webpack]: http://webpack.github.io/
[SystemJS]: https://github.com/systemjs/systemjs
[JSPM]: http://jspm.io/
[Rollup]: http://rollupjs.org/
[npm]: http://npmjs.com/
[Bower]: http://bower.io

{% endmarkdown %}
{% include alert/end.html%}

PouchDB packages come in three flavors: *presets*, *plugins*, and
*utilities*.

**Presets** are a collection of plugins, which expose a `PouchDB` object that is ready to be used.

**Plugins** are features that can be added to a `PouchDB` instance using the `PouchDB.plugin()`
API.

**Utilities** are grab-bags of helper functions, and are only recommended for advanced use cases.

#### Quick links

* [Presets](#presets)
* [Plugins](#plugins)
* [Utilities](#utilities)

{% include anchor.html class="h2" title="Presets" hash="presets" %}

Presets export a `PouchDB` object and contain a built-in set of PouchDB
plugins. You are free to create your own presets, but PouchDB provides a few first-party presets to address common use cases.

### pouchdb-browser

The `pouchdb-browser` preset contains the version of PouchDB that is designed
for the browser. In particular, it ships with the IndexedDB and WebSQL adapters
as its default adapters. It also contains the replication, HTTP, and map/reduce plugins.

Use this preset if you only want to use PouchDB in the browser,
and don't want to use it in Node.js. (E.g. to avoid installing LevelDB.)

#### Example Usage

```bash
npm install pouchdb-browser
```

```js
var PouchDB = require('pouchdb-browser');
var db = new PouchDB('mydb');
```

#### Source code (simplified)

```js
var PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-idb'))
  .plugin(require('pouchdb-adapter-websql'))
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-mapreduce'))
  .plugin(require('pouchdb-replication'));
```

### pouchdb-node

The `pouchdb-node` preset contains the version of PouchDB that is designed for
Node.js. In particular, it uses the LevelDB adapter and doesn't ship with the
IndexedDB or WebSQL adapters. It also contains the replication, HTTP, and map/reduce plugins.

Use this preset if you are only using PouchDB in Node, and not in the browser.

#### Example Usage

```bash
npm install pouchdb-node
```

```js
var PouchDB = require('pouchdb-node');
var db = new PouchDB('mydb');
```

#### Source code (simplified)

```js
var PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-leveldb'))
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-mapreduce'))
  .plugin(require('pouchdb-replication'));
```

### pouchdb-http

The `pouchdb-http` preset only contains the HTTP adapter, i.e. the adapter that
allows PouchDB to talk to CouchDB using the format `new PouchDB('http://127.0.0.1:5984/mydb')`. Note that
this preset does not come with map/reduce, so you cannot use the `query()` API.

Use this preset if you only want to use PouchDB as an interface to CouchDB (or a Couch-compatible server).

#### Example Usage

```bash
npm install pouchdb-http
```

```js
var PouchDB = require('pouchdb-http');
var db = new PouchDB('http://127.0.0.1:5984/mydb');
```

#### Source code (simplified)

```js
var PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-http'));
```

### pouchdb-core

The `pouchdb-core` package is a special preset in that it exposes the minimum
number of APIs. It contains zero plugins and is designed to be used in addition
with other plugins. By itself, it probably isn't very useful.

#### Example Usage

```bash
npm install pouchdb-core
```

```js
var PouchDB = require('pouchdb-core');
PouchDB.plugin(/* attach plugins to make me more interesting! */);
```

{% include anchor.html class="h2" title="Plugins" hash="plugins" %}

Plugins contain functionality that can be added to a `PouchDB` instance using `PouchDB.plugin()`. There are many [third-party plugins](/external.html), but the ones described below are first-party plugins, which are given the same level of support as PouchDB itself. Some first-party plugins are included in the default `pouchdb` build, whereas others aren't.

There is also a special type of plugin called an _adapter plugin_.  Adapter plugins (such as IndexedDB, WebSQL, LevelDB, and HTTP) determine the storage format that
PouchDB uses. For the non-HTTP adapters, the plugin order matters, i.e. if you
want IndexedDB to be preferred to WebSQL, then you should load it first. (Notice that `pouchdb-browser` does exactly this.)

### pouchdb-adapter-idb

The primary adapter used by PouchDB in the browser, using IndexedDB. The adapter
name is `'idb'`.

#### Example usage

```bash
npm install pouchdb-adapter-idb
```

```js
PouchDB.plugin(require('pouchdb-adapter-idb'));
var db = new PouchDB('mydb', {adapter: 'idb'});
console.log(db.adapter); // 'idb'
```

### pouchdb-adapter-websql

The secondary adapter used by PouchDB in the browser, using WebSQL. The adapter
name is `'websql'`.

#### Example usage

```bash
npm install pouchdb-adapter-websql
```

```js
PouchDB.plugin(require('pouchdb-adapter-websql'));
var db = new PouchDB('mydb', {adapter: 'websql'});
console.log(db.adapter); // 'websql'
```

### pouchdb-adapter-leveldb

The primary adapter used by PouchDB in Node.js, using LevelDB. The adapter name
is `'leveldb'`.

#### Example usage

```bash
npm install pouchdb-adapter-leveldb
```

```js
PouchDB.plugin(require('pouchdb-adapter-leveldb'));
var db = new PouchDB('mydb', {adapter: 'leveldb'});
console.log(db.adapter); // 'leveldb'
```

### pouchdb-adapter-http

The primary adapter used by PouchDB in both Node.js and the browser for communicating
with external CouchDB (or CouchDB-like) servers.

This plugin can be added to PouchDB in any order, and is somewhat special in that
you must pass in a name like `'http://...'` in order to use it. The adapter name
is either `'http'` or `'https'` depending on the protocol.

#### Example usage

```bash
npm install pouchdb-adapter-http
```

```js
PouchDB.plugin(require('pouchdb-adapter-http'));
var db = new PouchDB('http://127.0.0.1:5984/mydb');
console.log(db.adapter); // 'http'
```

### pouchdb-adapter-memory

An optional adapter that works in the browser and Node.js, fully in-memory. The adapter name
is `'memory'`.

#### Example usage

```bash
npm install pouchdb-adapter-memory
```

```js
PouchDB.plugin(require('pouchdb-adapter-memory'));
var db = new PouchDB('mydb', {adapter: 'memory'});
console.log(db.adapter); // 'memory'
```

### pouchdb-adapter-localstorage

An optional adapter that works in the browser using LocalStorage. The adapter name
is `'localstorage'`.

#### Example usage

```bash
npm install pouchdb-adapter-localstorage
```

```js
PouchDB.plugin(require('pouchdb-adapter-localstorage'));
var db = new PouchDB('mydb', {adapter: 'localstorage'});
console.log(db.adapter); // 'localstorage'
```

### pouchdb-adapter-fruitdown

An optional adapter that works in the browser using IndexedDB via [fruitdown](https://github.com/nolanlawson/fruitdown). The adapter name
is `'fruitdown'`.

#### Example usage

```bash
npm install pouchdb-adapter-fruitdown
```

```js
PouchDB.plugin(require('pouchdb-adapter-fruitdown'));
var db = new PouchDB('mydb', {adapter: 'fruitdown'});
console.log(db.adapter); // 'fruitdown'
```

### pouchdb-adapter-node-websql

An optional adapter that works in Node.js using SQLite via [node-websql](https://github.com/nolanlawson/node-websql). The adapter name
is `'websql'`.

#### Example usage

```bash
npm install pouchdb-adapter-node-websql
```

```js
PouchDB.plugin(require('pouchdb-adapter-node-websql'));
var db = new PouchDB('mydb', {adapter: 'websql'});
console.log(db.adapter); // 'websql'
```

### pouchdb-mapreduce

PouchDB's map/reduce API, exposed via the `query()` and `viewCleanup()` methods. Ships by default in PouchDB.

#### Example usage

```bash
npm install pouchdb-mapreduce
```

```js
PouchDB.plugin(require('pouchdb-mapreduce'));
var db = new PouchDB('mydb');
db.query(/* see query API docs for full info */);
```

### pouchdb-replication

PouchDB's replication API, exposed via the `replicate()` and `sync()` methods. Ships by default in PouchDB.

#### Example usage

```bash
npm install pouchdb-replication
```

```js
PouchDB.plugin(require('pouchdb-replication'));
var db = new PouchDB('mydb');
db.replicate(/* see replicate/sync API docs for full info */);
```

{% include anchor.html class="h2" title="Utilities" hash="utilities" %}

These utilities are intended only for advanced users of PouchDB, such as
third-party plugin authors. Formerly, many of them were exposed via the `extras/` API, which
is now deprecated.

Most of these are internal, and the APIs are not thoroughly documented. You will
most likely need to read the source code to understand how they work.

{% include alert/start.html variant="warning"%}
{% markdown %}

**Warning:** you are entering a semver-free zone.

In contrast to the presets and plugins listed above, **none of the following packages
follow semver**. Their versions are pinned to PouchDB's, and may change at any time
without warning. You are strongly recommended to **use exact versions** when installing these packages.

{% endmarkdown %}
{% include alert/end.html%}

### pouchdb-adapter-utils

Utilities for PouchDB adapters.

#### Example usage

```bash
npm install --save-exact pouchdb-adapter-utils
```

### pouchdb-ajax

PouchDB's `ajax()` function.

#### Example usage

```bash
npm install --save-exact pouchdb-ajax
```

### pouchdb-binary-utils

Utilities for operating on binary strings and Buffers/Blobs.

#### Example usage

```bash
npm install --save-exact pouchdb-binary-utils
```

### pouchdb-checkpointer

Tool to write a checkpoint, e.g. during replication.

#### Example usage

```bash
npm install --save-exact pouchdb-checkpointer
```

### pouchdb-errors

Errors exposed by PouchDB.

#### Example usage

```bash
npm install --save-exact pouchdb-errors
```

### pouchdb-generate-replication-id

Function to generate a replication ID to mark progress during replications.

#### Example usage

```bash
npm install --save-exact pouchdb-generate-replication-id
```

### pouchdb-json

Utilities for safely stringifying and parsing JSON.

#### Example usage

```bash
npm install --save-exact pouchdb-json
```

### pouchdb-mapreduce-utils

Utilities used by `pouchdb-mapreduce`.

#### Example usage

```bash
npm install --save-exact pouchdb-mapreduce-utils
```

### pouchdb-md5

Utilities for calculating MD5 checksums.

#### Example usage

```bash
npm install --save-exact pouchdb-md5
```

### pouchdb-merge

PouchDB's CouchDB-style document merge algorithm.

#### Example usage

```bash
npm install --save-exact pouchdb-merge
```

### pouchdb-promise

A `Promise` object, polyfilled using `lie` if Promises aren't available globally.

#### Example usage

```bash
npm install --save-exact pouchdb-promise
```

### pouchdb-utils

A potpourri of miscellaneous utilities used by PouchDB and its sub-packages.

#### Example usage

```bash
npm install --save-exact pouchdb-utils
```
