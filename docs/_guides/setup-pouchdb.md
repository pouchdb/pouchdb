---
index: 3
layout: guide
title: Setting up PouchDB
sidebar: guides_nav.html
---


Installing PouchDB is easy. There are a few different ways to do it:

Direct download
------
    
Download the latest **pouchdb-{{site.version}}.min.js** from the big green button above. Then in your `index.html`:

```html
<script src="pouchdb-{{site.version}}.min.js"></script>
```

Bower
-------

Run this on the command line:

```
$ bower install pouchdb
```

Then in your `index.html`:

```html
<script src="bower_components/pouchdb/dist/pouchdb.min.js"></script>
```

npm
------

Run this on the command line:

```
$ npm install pouchdb
```

Then in your `index.html`:

```html
<script src="node_modules/pouchdb/dist/pouchdb.min.js"></script>
```

jsdelivr CDN
------

Add this to your `index.html`:

```html
<script src="//cdn.jsdelivr.net/pouchdb/{{site.version}}/pouchdb.min.js"></script>
```

Node.js
-------

Run this on the command line:

```
$ npm install pouchdb
```

Then in your JavaScript:

```js
var PouchDB = require('pouchdb');
```

Next
-------

Now that you have PouchDB installed, let's start working with databases.