---
index: 3
layout: guide
title: Setting up PouchDB
sidebar: guides_nav.html
---


Installing PouchDB is easy. There are a few different ways to do it:

{% include anchor.html title="Direct download" hash="direct-download" %}

Download the latest **pouchdb-{{site.version}}.min.js** from the big green button above. Then in your `index.html`:

```html
<script src="pouchdb-{{site.version}}.min.js"></script>
```

{% include anchor.html title="Bower" hash="bower" %}

Run this on the command line:

```
$ bower install pouchdb
```

Then in your `index.html`:

```html
<script src="bower_components/pouchdb/dist/pouchdb.min.js"></script>
```

{% include anchor.html title="npm" hash="npm" %}

Run this on the command line:

```
$ npm install pouchdb
```

Then in your `index.html`:

```html
<script src="node_modules/pouchdb/dist/pouchdb.min.js"></script>
```

{% include anchor.html title="jsdelivr CDN" hash="jsdelivr-cdn" %}

Add this to your `index.html`:

```html
<script src="//cdn.jsdelivr.net/pouchdb/{{site.version}}/pouchdb.min.js"></script>
```

{% include anchor.html title="Node.js" hash="nodejs" %}

Run this on the command line:

```
$ npm install pouchdb
```

Then in your JavaScript:

```js
var PouchDB = require('pouchdb');
```

{% include anchor.html title="Next" hash="next" %}

Now that you have PouchDB installed, let's start working with databases.