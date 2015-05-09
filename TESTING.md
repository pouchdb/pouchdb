Running PouchDB Tests
--------------------------------------

The PouchDB test suite expects an instance of CouchDB running in [Admin Party](http://guide.couchdb.org/draft/security.html#party) on http://127.0.0.1:5984, you can configure this by sending the `COUCH_HOST` env var.

 * PouchDB has been primarily developed on Linux and OSX, if you are using Windows then these instructions will have problems, we would love your help fixing them though.

### Node Tests

Given that you have [installed a CouchDB server](#installing-a-couchdb-server).

Run all tests with:

    $ npm test

### Browser Tests

Browser tests can be run automatically with:

    $ CLIENT=selenium:firefox npm test

or you can run:

    $ npm run dev

and open [http://127.0.0.1:8000/tests/test.html](http://127.0.0.1:8000/tests/test.html) in your browser of choice. The performance tests are located @ [http://localhost:8000/tests/performance/test.html](http://localhost:8000/tests/performance/test.html).

### Test Options

#### Subset of tests:

    $ GREP=test.replication.js npm test

or append `?grep=test.replication.js` if you opened the tests in a browser manually.

#### Test Coverage

    $ COVERAGE=1 npm test

#### Test alternative server

    $ COUCH_HOST=http://user:pass@myname.host.com npm run dev

or

    $ COUCH_HOST=http://user:pass@myname.host.com npm test

#### Test with ES5 shims

Some older browsers require [es5 shims](https://github.com/es-shims/es5-shim). Enable them with:

    $ ES5_SHIM=true npm run dev

or e.g.:

    $ ES5_SHIM=true CLIENT=selenium:phantomjs npm test

or you can append it as `?es5shim=true` if you manually opened a browser window.

### Cordova tests

You may need to install `ant` in order for the Android tests to run (e.g. `brew install ant`). You'll also need the Android SDK, and to make sure your `$ANDROID_HOME` is set.

Run the tests against an iOS simulator:

    $ CLIENT=ios npm run cordova
    
Run the tests against a connected Android device, using the given COUCH_HOST    
    
    $ CLIENT=android DEVICE=true COUCH_HOST=http://example.com:5984

Run the tests against the FirefoxOS simulator:

    $ CLIENT=firefoxos npm run cordova
    
Run the tests against a BlackBerry 10 device:

    $ CLIENT=blackberry10 DEVICE=true npm run cordova

Use a custom Couch host:

    $ COUCH_HOST=http://myurl:5984 npm run cordova

Grep some tests:    

    $ GREP=basics npm run cordova
    
Test against the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin):

    $ SQLITE_PLUGIN=true ADAPTERS=websql npm run cordova

**Notes:**

* `CLIENT=ios` will run on iOS, default is `CLIENT=android`
* `DEVICE=true` will run on a device connected via USB, else on an emulator (default is the emulator)
* `SQLITE_PLUGIN=true` will install and use the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin).
* `ADAPTERS=websql` should be used if you want to skip using IndexedDB on Android 4.4+ or if you want to force the SQLite Plugin.
* `COUCH_HOST` should be the full URL; you can only omit this is in the Android emulator due to the magic `10.0.2.2` route to `localhost`.
* `ES5_SHIM=true` should be used on devices that don't support ES5 (e.g. Android 2.x).

**WEINRE debugging:**

You can also debug with Weinre by doing:

    $ npm install -g weinre
    $ weinre --boundHost=0.0.0.0
    
Then run the tests with:

    $ WEINRE_HOST=http://route.to.my.weinre:8080 npm run cordova

### Testing against PouchDB server

[pouchdb-server](https://github.com/nick-thompson/pouchdb-server) is a project that uses [express-pouchdb](https://github.com/nick-thompson/express-pouchdb) to run a CouchDB-compliant server backed by PouchDB.

To test the latest and greatest version of pouchdb-server, you can do e.g.:

    SERVER=pouchdb-server npm test
    SERVER=pouchdb-server CLIENT=selenium:firefox npm test

If you would like to modify pouchdb-server while testing, then git clone the express-pouchdb and pouchdb-server projects, `npm link` them all together, and then run:

        node /path/to/pouchdb-server/bin/pouchdb-server -p 6984

Then in the PouchDB project, run:

    COUCH_HOST=http://localhost:6984 npm run dev

This works because `npm run dev` does not start up the pouchdb-server itself (only `npm test` does).

### Testing the in-memory adapter

`pouchdb-server` uses the `--in-memory` flag to use MemDOWN.  To enable this, set

    SERVER_ADAPTER=memory

Whereas on the client this is configured using `PouchDB.defaults()`, so you can enable it like so:

    LEVEL_ADAPTER=memdown

The value is a comma-separated list of key values, where the key-values are separated by colons.

Some Level adapters also require a standard database name prefix (e.g. `riak://` or `mysql://`), which you can specify like so:

    LEVEL_PREFIX=riak://localhost:8087/

### Testing Pouch in a shell

For quick debugging, you can run an interactive Node shell with the `PouchDB` variable already available:

    npm run shell

### Performance tests

    PERF=1 npm test

To run the performance test suite in node.js or the automated browser runner.

### Performance tests in the browser

You can specify a particular version of PouchDB or a particular adapter by doing e.g.:

    http://localhost:8000/tests/performance/test.html?src=http://site.com/path/to/pouchdb.js
    http://localhost:8000/tests/performance/test.html?adapter=websql
    http://localhost:8000/tests/performance/test.html?adapter=idb&src=//site.com/pouchdb.js

All of the browser plugin adapters (i.e. `idb-alt`, `memory`, and `localstorage`) are also available this way.

You can also specify particular tests by using `grep=`, e.g.:

    http://127.0.0.1:8000/tests/performance/test.html?grep=basics
    http://127.0.0.1:8000/tests/performance/test.html?grep=basic-inserts

### Ad-hoc tests

There's a WebSQL storage quota test available in:

    http://127.0.0.1:8000/tests/stress/websql_storage_limit.html

Run `npm run dev`, then open it in Safari or iOS.

Adapter plugins and adapter order
--------------------------------------

We are currently building three adapters-as-plugins: `memory`, `localstorage`, and `idb-alt`.  All are based on the [LevelDOWN API](https://github.com/rvagg/abstract-leveldown):

* `memory`: based on [MemDOWN](https://github.com/rvagg/memdown)
* `localstorage`: based on [localstorage-down](https://github.com/no9/localstorage-down)
* `idb-alt`: based on [level-js](https://github.com/maxogden/level.js), will probably replace `idb.js` someday

These adapters are built and included in the `dist/` folder as e.g. `pouchdb.memory.js`.  Including these scripts after `pouchdb.js` will load the adapters, placing them in the `PouchDB.preferredAdapters` list after `idb` and `websql` by default.

    <script src="pouchdb.js"></script>
    <script>console.log(PouchDB.preferredAdapters); // ['idb', 'websql']</script>
    <script src="pouchdb.memory.js"></script>
    <script>console.log(PouchDB.preferredAdapters); // ['idb', 'websql', 'memory']</script>

To test these adapters, you can run e.g.

    ADAPTERS=memory CLIENT=selenium:firefox npm run test

Or append them as query params in the browser:

    http://localhost:8000/tests/test.html?adapters=memory

The `adapters` list is a comma-separated list that will be used for `PouchDB.preferredAdapters`.  So e.g. if you want to test `websql` in Chrome, you can do:

    http://localhost:8000/tests/test.html?adapters=websql

Or even make the `preferredAdapters` list any crazy thing you want:

    # loads websql, then memory, then idb, then localstorage
    http://localhost:8000/tests/test.html?adapters=websql,memory,idb,localstorage

Keep in mind that `preferredAdapters` only applies to non-http, non-https adapters.

### Installing a CouchDB server

Regular install
---------------------------

See the [official CouchDB documentation](http://docs.couchdb.org/en/1.6.1/install/index.html) for a guide on how to install CouchDB.

Docker install
-----------------------------

Don't have a CouchDB installed on your machine? Don't want one? Let's use [docker](https://www.docker.com/)
and [fig](http://www.fig.sh/).

1. [Install Docker](https://docs.docker.com/installation/#installation)
2. [Install Fig](http://www.fig.sh/install.html)
3. Run `fig -f tests/misc/fig.yml up -d` from PouchDB project root folder to download and run a CouchDB server in docker
4. Check with `fig -f tests/misc/fig.yml ps` that `couchdb` is running and listen on `0.0.0.0:15984`
5. Run the test suite with: `COUCH_HOST=http://127.0.0.1:15984 npm test`

Now everytime you want to run the test suite, you just need to:
    $ fig -f tests/misc/fig.yml start
