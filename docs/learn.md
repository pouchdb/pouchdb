---
layout: 2ColLeft
title: About PouchDB
sidebar: nav.html
---

PouchDB is an **in-browser database** that allows applications to save data locally, so that users can enjoy all the features of an app even when they're offline. Plus, the data is synchronized between clients, so users can stay up-to-date wherever they go.

PouchDB also runs in **Node.js** and can be used as a direct interface to **CouchDB**-compatible servers. The API works the same in every environment, so you can spend less time worrying about browser differences, and more time writing clean, consistent code.

PouchDB is a free open-source project, written in JavaScript and driven by our [wonderful  community](https://github.com/pouchdb/pouchdb/graphs/contributors). If you want to get involved, then check out the [contributing guide](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

{% include anchor.html class="h3" title="Installing" hash="installing" %}

To start using PouchDB in your website, simply [download][latest-min] it and include it in your page:

{% highlight html %}
<script src="pouchdb-{{ site.version }}.min.js"></script>
{% endhighlight %}

Or install it with Bower:

{% highlight bash %}$ bower install --save pouchdb{% endhighlight %}

Or install it as a Node.js module:

{% highlight bash %}$ npm install --save pouchdb{% endhighlight %}

{% include anchor.html class="h3" title="Using PouchDB" hash="using_pouchdb" %}

In the browser, getting started is as simple as:

{% highlight javascript %}
var db = new PouchDB('my_database');
{% endhighlight %}

In Node.js, you'll need to `require()` it first:

{% highlight javascript %}
var PouchDB = require('pouchdb');
var db = new PouchDB('my_database');
{% endhighlight %}

Or, to use PouchDB as a direct client to CouchDB, simply pass in a URL:

{% highlight javascript %}
var db = new PouchDB('http://localhost:5984/my_database');
{% endhighlight %}

All of these `db`s share the same API, regardless of where they're storing data!

To learn more about how to use PouchDB, check out our [Getting Started Tutorial](getting-started.html), [Guides](/guides/) and the [API Documentation](api.html).

{% include anchor.html class="h3" title="Browser Support" hash="browser_support" %}

PouchDB supports all modern browsers, using [IndexedDB][] under the hood and falling back to [WebSQL][] where IndexedDB isn't supported. It is [fully tested](https://travis-ci.org/pouchdb/pouchdb/) and supported in:

 * Firefox 29+
 * Chrome 30+
 * Safari 5+
 * Internet Explorer 10+
 * Opera 21+
 * Android 4.0+
 * iOS 7.1+
 * Windows Phone 8+

PouchDB also runs in [Cordova/PhoneGap](https://github.com/nolanlawson/pouchdb-phonegap-cordova), [NW.js](https://github.com/nolanlawson/pouchdb-nw), [Atom Shell](pouchdb-atom-shell), and [Chrome apps](https://github.com/nolanlawson/pouchdb-chrome-app). It is framework-agnostic, and you can use it with Angular, React, Ember, Backbone, or your framework of choice. There are [many adapters](http://pouchdb.com/external.html#framework_adapters), or you can just use PouchDB as-is.

PouchDB requires a modern ES5 environment, so if you need to support older browsers (IE <10, Android <4.0, Opera Mini), then you should include the [es5-shim](https://github.com/es-shims/es5-shim) library.  You can also use the [LocalStorage and in-memory adapters](/adapters.html#pouchdb_in_the_browser), or fall back to a live CouchDB.

{% include anchor.html class="h3" title="Node.js" hash="node_js" %}

In Node.js, PouchDB uses [LevelDB][] under the hood, and also supports [many other backends](/adapters.html#pouchdb_in_node_js) via the [LevelUP ecosystem](https://github.com/rvagg/node-levelup).

PouchDB can also run as its own CouchDB-compatible web server, using [PouchDB Server](https://github.com/pouchdb/pouchdb-server).

{% include anchor.html class="h3" title="Downloads" hash="downloads" %}

Latest and greatest: 

* [pouchdb-{{ site.version }}.min.js][latest-min] (compressed for production)
* [pouchdb-{{ site.version }}.js][latest] (uncompressed for debugging)

PouchDB is also hosted on [jsdelivr](http://www.jsdelivr.com/#!pouchdb) and [cdnjs](https://cdnjs.com/libraries/pouchdb).

For past releases and changelog, check out the [Github releases page](https://github.com/pouchdb/pouchdb/releases).

For plugins, see the [plugins page](/external.html).

[IndexedDB]: http://caniuse.com/#feat=indexeddb
[WebSQL]: http://caniuse.com/#feat=sql-storage
[LevelDB]: http://leveldb.org/
[latest]: https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.js
[latest-min]: https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.min.js