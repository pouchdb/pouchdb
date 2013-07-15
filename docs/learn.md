---
layout: learn
title: PouchDB, the JavaScript Database that Syncs!
---

# About PouchDB

PouchDB was written to help web developers build applications that work as well offline as well as they do online, applications save data locally so the user can use all the features of an app even while offline and synchronise the data between clients so they have up to date data wherever they go.

PouchDB is a free open source project, written in Javascript by these [wonderful contributors](https://github.com/daleharvey/pouchdb/graphs/contributors) and inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a>. If you want to get involved then check out the [contributing guide](https://github.com/daleharvey/pouchdb/blob/master/CONTRIBUTING.md)

# Browser Support

PouchDB uses various backends so it can work across various browsers and in Node.js. It uses IndexedDB in Firefox and Chrome, WebSQL in Safari and Opera and LevelDB in Node.js. It is currently tested in:

 * Firefox 12+
 * Chrome 19+
 * Opera 12+
 * Safari 5+
 * [Node.js 0.10+](http://nodejs.org/)
 * [Apache Cordova](http://cordova.apache.org/)
 * Internet Explorer 10+

If your application requires support for Internet Explorer below version 10, it is possible to use an online CouchDB as a fallback, however it will not work offline.

# Current Status

PouchDB in the browser currently beta release software, it is extensively tested and the functionality implemented is known to be stable however you may find bugs in lesser used parts of the API. The API is currently stable with no known changes and you will be able to upgrade PouchDB without losing data. We are currently working towards a stable release of PouchDB.

PouchDB in Node.js is currently alpha and an upgrade to the library can break current databases. It is however possible to upgrade by replicating data across different versions to manually upgrade.

# Installing

PouchDB is designed to be a minimal library that is suitable for mobile devices, to start using PouchDB in your website you simply [Download](http://download.pouchdb.com) and include it in your webpage.

{% highlight html %}<script src="pouchdb-nightly.min.js"></script>{% endhighlight %}

If you are using Node.js then

{% highlight bash %}$ npm install pouchdb{% endhighlight %}

For a HTTP API to PouchDB check out [PouchDB Server](https://github.com/nick-thompson/pouchdb-server)

# Using PouchDB

To get started using PouchDB check out our [Getting Started Tutorial](getting-started.html) and the [API Documentation](api.html).