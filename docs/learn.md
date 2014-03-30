---
layout: 2ColLeft
title: About PouchDB
sidebar: nav.html
---

PouchDB was written to help web developers build applications that work offline as well as they do online. Applications save data locally, so the user can use all the features of an app even when they're offline. Plus, the data is synchronized between clients, so the user has up-to-date data wherever they go.

PouchDB is a free open-source project, written in JavaScript by these [wonderful contributors](https://github.com/daleharvey/pouchdb/graphs/contributors) and inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a>. If you want to get involved then check out the [contributing guide](https://github.com/daleharvey/pouchdb/blob/master/CONTRIBUTING.md).

### Browser Support

PouchDB uses various backends so it can work across different browsers and in Node.js. It uses IndexedDB in Firefox/Chrome/Opera/IE, WebSQL in Safari, and LevelDB in Node.js. It is currently tested in:

 * Firefox 12+
 * Chrome 19+
 * Opera 12+
 * Safari 5+
 * Internet Explorer 10+
 * [Node.js 0.10+](http://nodejs.org/)
 * [Apache Cordova](http://cordova.apache.org/)

For details on supported browsers, see ["Can I use IndexedDB?"][caniuse-idb] and ["Can I use Web SQL Database?"][caniuse-websql].

  [caniuse-idb]: http://caniuse.com/indexeddb
  [caniuse-websql]: http://caniuse.com/sql-storage

If your application requires support for Internet Explorer below version 10, it is possible to use an online CouchDB as a fallback, however it will not work offline. Also, because PouchDB requires an ES5 environment, you will need to include the [es5-shim](https://github.com/es-shims/es5-shim) library. This also applies to other legacy browsers, such as Android <4.0 and Opera Mini.

### Current Status

PouchDB in the browser is currently beta release software. It is extensively tested and the functionality implemented is known to be stable, however you may find bugs in lesser-used parts of the API. The API is currently stable with no known changes and you will be able to upgrade PouchDB without losing data. We are currently working towards a stable release of PouchDB.

PouchDB in Node.js is currently alpha and an upgrade to the library can break current databases. It is however possible to upgrade by replicating data across different versions to manually upgrade.

### Installing

PouchDB is designed to be a minimal library that is suitable for mobile devices, tablets, desktops &mdash; anything that runs Javascript. To start using PouchDB in your website, you simply [download][latest] it and include it in your webpage.

  [latest]: https://github.com/daleharvey/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.min.js

{% highlight html %}
<script src="pouchdb-{{ site.version }}.min.js"></script>
{% endhighlight %}

##### Downloads

Latest and greatest: [pouchdb-{{ site.version }}.min.js][latest]

For past releases and changelog, check out the [Github releases page](https://github.com/daleharvey/pouchdb/releases).

##### Node.js

If you are using Node.js then run

{% highlight bash %}$ npm install pouchdb{% endhighlight %}

For an HTTP API to PouchDB check out [PouchDB Server](https://github.com/nick-thompson/pouchdb-server).

### Using PouchDB

To get started using PouchDB, check out our [Getting Started Tutorial](getting-started.html) and the [API Documentation](api.html).
