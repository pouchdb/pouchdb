---
layout: 2ColLeft
title: About PouchDB
sidebar: nav.html
---

PouchDB is an **in-browser database** that allows applications to save data locally, so that users can enjoy all the features of an app even when they're offline. Plus, the data is synchronized between clients, so users can stay up-to-date wherever they go.

PouchDB also runs in **Node.js** and can be used as a direct interface to **CouchDB**-compatible servers. The API works the same in every environment, so you can spend less time worrying about browser differences, and more time writing clean, consistent code.

PouchDB is a free open-source project, written in JavaScript and driven by our [wonderful  community](https://github.com/pouchdb/pouchdb/graphs/contributors). If you want to get involved, then check out the [contributing guide](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

{% include anchor.html class="h3" title="Browser Support" hash="browser_support" %}

PouchDB supports all modern browsers, using [IndexedDB][] under the hood and falling back to [WebSQL][] where IndexedDB isn't supported. It is [fully tested](https://github.com/pouchdb/pouchdb/actions) and supported in:

 * Firefox 29+ (Including Firefox OS and Firefox for Android)
 * Chrome 30+
 * Safari 5+
 * Internet Explorer 10+
 * Opera 21+
 * Android 4.0+
 * iOS 7.1+
 * Windows Phone 8+

PouchDB also runs in [Cordova/PhoneGap](https://github.com/nolanlawson/pouchdb-phonegap-cordova), [NW.js](https://github.com/nolanlawson/pouchdb-nw), [Electron](https://github.com/nolanlawson/pouchdb-atom-shell), and [Chrome apps](https://github.com/nolanlawson/pouchdb-chrome-app). It is framework-agnostic, and you can use it with Angular, React, Ember, Backbone, or your framework of choice. There are [many adapters]({{ site.baseurl }}/external.html#framework_adapters), or you can just use PouchDB as-is.

PouchDB requires a modern ES5 environment, so if you need to support older browsers (IE <10, Android <4.0, Opera Mini), then you should include the [es5-shim](https://github.com/es-shims/es5-shim) library.  You can also use the [LocalStorage and in-memory adapters](/adapters.html#pouchdb_in_the_browser), or fall back to a live CouchDB.

{% include anchor.html class="h3" title="Node.js" hash="node_js" %}

In Node.js, PouchDB uses [LevelDB][] under the hood, and also supports [many other backends](/adapters.html#pouchdb_in_node_js) via the [LevelUP ecosystem](https://github.com/rvagg/node-levelup).

PouchDB can also run as its own CouchDB-compatible web server, using [PouchDB Server](https://github.com/pouchdb/pouchdb-server).

[IndexedDB]: http://caniuse.com/#feat=indexeddb
[WebSQL]: http://caniuse.com/#feat=sql-storage
[LevelDB]: https://github.com/google/leveldb
