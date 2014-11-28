PouchDB Plugin Seed
=====

[![Build Status](https://travis-ci.org/pouchdb/plugin-seed.svg)](https://travis-ci.org/pouchdb/plugin-seed)

Fork this project to build your first PouchDB plugin.  It contains everything you need to test in Node, WebSQL, and IndexedDB.  It also includes a Travis config file so you
can automatically run the tests in Travis.

Building
----
    npm install
    npm run build

Your plugin is now located at `dist/pouchdb.mypluginname.js` and `dist/pouchdb.mypluginname.min.js` and is ready for distribution.

Getting Started
-------

**First**, change the `name` in `package.json` to whatever you want to call your plugin.  Change the `build` script so that it writes to the desired filename (e.g. `pouchdb.mypluginname.js`).  Also, change the authors, description, git repo, etc.

**Next**, modify the `index.js` to do whatever you want your plugin to do.  Right now it just adds a `pouch.sayHello()` function that says hello:

```js
exports.sayHello = utils.toPromise(function (callback) {
  callback(null, 'hello');
});
```

**Optionally**, you can add some tests in `tests/test.js`. These tests will be run both in the local database and a remote CouchDB, which is expected to be running at localhost:5984 in "Admin party" mode.

The sample test is:

```js

it('should say hello', function () {
  return db.sayHello().then(function (response) {
    response.should.equal('hello');
  });
});
```

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage

If you don't like the coverage results, change the values from 100 to something else in `package.json`, or add `/*istanbul ignore */` comments.


If you have mocha installed globally you can run single test with:
```
TEST_DB=local mocha --reporter spec --grep search_phrase
```

The `TEST_DB` environment variable specifies the database that PouchDB should use (see `package.json`).

### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL.

What to tell your users
--------

Below is some boilerplate you can use for when you want a real README for your users.

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
