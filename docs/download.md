---
layout: 2ColLeft
title: Download
sidebar: nav.html
---

{% include anchor.html class="h3" title="File Download" hash="file" %}

The PouchDB file should come before any files that use it.

For use in a HTML file:

{% highlight html %}
<script src="https://cdnjs.cloudflare.com/ajax/libs/pouchdb/{{ site.version }}/pouchdb.min.js"></script>
<script>
  var db = new PouchDB('my_database');
</script>
{% endhighlight %}

PouchDB is supplied as a compressed and uncompressed download:

* [Download pouchdb-{{ site.version }}.min.js][latest-min] (compressed for production)
* [Download pouchdb-{{ site.version }}.js][latest] (uncompressed for debugging)

PouchDB is also hosted on Content Delivery Networks:

* [PouchDB on jsdelivr](http://www.jsdelivr.com/#!pouchdb)
* [PouchDB on cdnjs](https://cdnjs.com/libraries/pouchdb).

{% include anchor.html class="h3" title="npm" hash="npm" %}

PouchDB can also be installed through [npm](http://npmjs.com) for Node.js. This can be used on the server and/or browser.

**A bundler such as [browserify](http://browserify.org/) or [webpack](https://webpack.github.io/) is needed for browser usage.**

{% highlight bash %}npm install --save pouchdb{% endhighlight %}

After installing, you can require and use:

{% highlight javascript %}
var PouchDB = require('pouchdb');
var db = new PouchDB('my_database');
{% endhighlight %}

{% include anchor.html class="h3" title="Bower" hash="bower" %}

PouchDB can be installed through [bower](http://bower.io).

{% highlight bash %}bower install --save pouchdb{% endhighlight %}

{% include anchor.html class="h3" title="Past releases" hash="past-releases" %}

For past releases and changelog, check out the [Github releases page](https://github.com/pouchdb/pouchdb/releases).

{% include anchor.html class="h3" title="Plugins" hash="plugins" %}

For plugins, see the [plugins page](/external.html).

[latest]: https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.js
[latest-min]: https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.min.js
