---
layout: 2ColLeft
title: Download
sidebar: nav.html
---

{% include anchor.html class="h3" title="Quick Start" hash="file" %}

{% highlight html %}
<script src="//cdn.jsdelivr.net/npm/pouchdb@{{site.version}}/dist/pouchdb.min.js"></script>
<script>
  var db = new PouchDB('my_database');
</script>
{% endhighlight %}

PouchDB can also be directly downloaded:

* [pouchdb-{{ site.version }}.min.js][latest-min] (compressed for production)
* [pouchdb-{{ site.version }}.js][latest] (uncompressed for debugging)

{% include anchor.html class="h3" title="npm" hash="npm" %}

PouchDB can be installed through [npm](http://npmjs.com):

{% highlight bash %}npm install --save pouchdb{% endhighlight %}

After installing, call `require()` to use it:

{% highlight javascript %}
var PouchDB = require('pouchdb');
var db = new PouchDB('my_database');
{% endhighlight %}

PouchDB can be used either in Node or in the browser. A bundler such as [Browserify](http://browserify.org/), [Webpack](https://webpack.github.io/), or [Rollup](http://rollupjs.org/) is needed for browser usage.

#### Browser only

If you're only using PouchDB in the browser, you can use `pouchdb-browser` for
faster install times:

{% highlight bash %}npm install --save pouchdb-browser{% endhighlight %}

{% highlight javascript %}
var PouchDB = require('pouchdb-browser');
var db = new PouchDB('my_database');
{% endhighlight %}

See [custom builds](http://pouchdb.com/custom.html) for more options.

{% include anchor.html class="h3" title="CDNs" hash="cdn" %}

PouchDB is hosted at these CDNs:

* [cdnjs](https://cdnjs.com/libraries/pouchdb)
* [jsdelivr](http://www.jsdelivr.com/#!pouchdb)
* [unpkg](https://unpkg.com/pouchdb@{{ site.version }}/dist/)

{% include anchor.html class="h3" title="Bower" hash="bower" %}

PouchDB can be installed through [Bower](http://bower.io).

{% highlight bash %}bower install --save pouchdb{% endhighlight %}

{% include anchor.html class="h3" title="Past releases" hash="past-releases" %}

For past releases and changelog, check out the [Github releases page](https://github.com/pouchdb/pouchdb/releases).

{% include anchor.html class="h3" title="Plugins" hash="plugins" %}

For third-party plugins, see the [plugins page](/external.html).

{% include anchor.html class="h3" title="Custom builds" hash="custom" %}

For custom builds and first-party plugins, see the [custom builds](http://pouchdb.com/custom.html) page.

[latest]: https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.js
[latest-min]: https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb-{{ site.version }}.min.js
