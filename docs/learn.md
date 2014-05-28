---
layout: 2ColLeft
title: About PouchDB
sidebar: nav.html
---

PouchDB was written to help web developers build applications that work offline as well as they do online. Applications save data locally, so the user can use all the features of an app even when they're offline. Plus, the data is synchronized between clients, so the user has up-to-date data wherever they go.

PouchDB is a free open-source project, written in JavaScript by these [wonderful contributors](https://github.com/daleharvey/pouchdb/graphs/contributors) and inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a>. If you want to get involved then check out the [contributing guide](https://github.com/daleharvey/pouchdb/blob/master/CONTRIBUTING.md).

### Browser Support

PouchDB uses various backends so it can work across different browsers and in Node.js. It uses IndexedDB in Firefox/Chrome/Opera/IE, WebSQL in Safari and most mobile browsers, and LevelDB in Node.js. It is currently tested and fully supported in:

 * Firefox latest stable (v29)
 * Chrome latest stable (v34)
 * Desktop Safari latest stable (v7)
 * Internet Explorer v10+
 * Opera latest stable (v21)
 * Android 4.3+
 * iOS Safari latest stable (v7.1)
 * [Node.js](http://nodejs.org/)

PouchDB is experimental on Android 2.x and various mobile browsers and environments including [Apache Cordova](http://cordova.apache.org/). It is known to work, but you may run into issues. As we resolve these issues we will update the fully supported list.

PouchDB requires an ES5 environment. If your browser does not support this (IE <= 9, Android < 4.0, Opera Mini), then you will need to include the [es5-shim](https://github.com/es-shims/es5-shim) library.

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
