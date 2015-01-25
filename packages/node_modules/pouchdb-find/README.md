PouchDB Find Plugin
=====

[![Build Status](https://travis-ci.org/nolanlawson/pouchdb-find.svg)](https://travis-ci.org/nolanlawson/pouchdb-find)

["Mango" query API](https://github.com/cloudant/mango) for PouchDB, basically replacing the old [map/reduce API](http://pouchdb.com/api.html#query_database) with something human beings can understand. Read [the Cloudant docs](https://docs.cloudant.com/api/cloudant-query.html) for all the juicy details.

**THIS IS A WORK IN PROGRESS! IT DOESN'T WORK YET!**

API
-----


### db.createIndex()

### db.getIndexes()

### db.deleteIndex()

### db.find()


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
