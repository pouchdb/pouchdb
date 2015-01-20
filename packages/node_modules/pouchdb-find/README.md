PouchDB Find Plugin
=====

[![Build Status](https://travis-ci.org/nolanlawson/pouchdb-find.svg)](https://travis-ci.org/nolanlawson/pouchdb-find)

THIS IS A WORK IN PROGRESS! IT DOESN'T WORK YET!
===================

How to contribute to this thing
----------

Instructions are in CONTRIBUTING.md.

Usage
------

To use this plugin, include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.mypluginname.js"></script>
```

Or to use it in Node.js, just npm install it:

```
npm install pouchdb-myplugin
```

And then attach it to the `PouchDB` object:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-myplugin'));
```