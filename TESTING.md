Running PouchDB Tests
--------------------------------------

The PouchDB test suite expects an instance of CouchDB (version 1.6.1 and above) running in [Admin Party](http://guide.couchdb.org/draft/security.html#party) on http://127.0.0.1:5984 with [CORS enabled](https://github.com/pouchdb/add-cors-to-couchdb), you can configure this by sending the `COUCH_HOST` env var.

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

and open [http://127.0.0.1:8000/tests/integration/index.html](http://127.0.0.1:8000/tests/integration/index.html) in your browser of choice. The performance tests are located @ [http://localhost:8000/tests/performance/index.html](http://localhost:8000/tests/performance/index.html).

### Unit tests

    $ npm run build-as-modular-es5
    $ npm run test-unit

These are tests that confirm small parts of PouchDB functionality. In order to
work correctly with ES6, they are first transpiled to `lib` as modular ES5 (`run run build-as-modular-es5`) using Babel, and then tested as CommonJS modules. See `build-as-modular-es5.sh` for details.

### Test Options

#### Subset of tests:

    $ GREP=test.replication.js npm test

or append `?grep=test.replication.js` if you opened the tests in a browser manually.

#### Test Coverage

    $ npm run build-as-modular-es5
    $ COVERAGE=1 npm test

Again, this uses `npm run build-as-modular-es5` in order to fully test the codebase
as a non-bundle. See `build-as-modular-es5.sh` for details.

#### Test alternative server

    $ COUCH_HOST=http://user:pass@myname.host.com npm run dev

or

    $ COUCH_HOST=http://user:pass@myname.host.com npm test

#### Other test options

* `SKIP_MIGRATION=1` should be used to skip the migration tests.
* `POUCHDB_SRC=../../dist/pouchdb.js` can be used to treat another file as the PouchDB source file.
* `npm run test-webpack` will build with Webpack and then test that in a browser.

#### Run the map/reduce tests

The map/reduce tests are done separately from the normal integration tests, because
they take a long time. They'll also cause a ton of popups in Safari due to exceeding
the 5MB limit.

    $ TYPE=mapreduce npm test

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

To run the node-websql test in Node, run the tests with:

    ADAPTER=websql

### Performance tests

To run the performance test suite in node.js:

    PERF=1 npm test

Or the automated browser runner:

    PERF=1 CLIENT=selenium:firefox npm test

You can also use `GREP` to run certain tests, or `LEVEL_ADAPTER` to use a certain *down adapter:

    PERF=1 GREP=basic-inserts LEVEL_ADAPTER=memdown npm test

### Performance tests in the browser

When you run `npm run dev`, performance tests are available at:

    http://localhost:8000/tests/performance/index.html

You can specify a particular version of PouchDB or a particular adapter by doing e.g.:

    http://localhost:8000/tests/performance/index.html?src=http://site.com/path/to/pouchdb.js
    http://localhost:8000/tests/performance/index.html?adapter=websql
    http://localhost:8000/tests/performance/index.html?adapter=idb&src=//site.com/pouchdb.js

All of the browser plugin adapters (i.e. `fruitdown`, `memory`, and `localstorage`) are also available this way.

You can also specify particular tests by using `grep=`, e.g.:

    http://127.0.0.1:8000/tests/performance/index.html?grep=basics
    http://127.0.0.1:8000/tests/performance/index.html?grep=basic-inserts

### Ad-hoc tests

There's a WebSQL storage quota test available in:

    http://127.0.0.1:8000/tests/stress/websql_storage_limit.html

Run `npm run dev`, then open it in Safari or iOS.

Adapter plugins and adapter order
--------------------------------------

We are currently building three adapters-as-plugins: `fruitdown`, `memory` and `localstorage`.  All are based on the [LevelDOWN API](https://github.com/rvagg/abstract-leveldown):

* `fruitdown`: based on [FruitDOWN](https://github.com/nolanlawson/fruitdown)
* `memory`: based on [MemDOWN](https://github.com/rvagg/memdown)
* `localstorage`: based on [localstorage-down](https://github.com/no9/localstorage-down)

These adapters are built and included in the `dist/` folder as e.g. `pouchdb.memory.js`.  Including these scripts after `pouchdb.js` will load the adapters, placing them in the `PouchDB.preferredAdapters` list after `idb` and `websql` by default.

    <script src="pouchdb.js"></script>
    <script>console.log(PouchDB.preferredAdapters); // ['idb', 'websql']</script>
    <script src="pouchdb.memory.js"></script>
    <script>console.log(PouchDB.preferredAdapters); // ['idb', 'websql', 'memory']</script>

To test these adapters, you can run e.g.

    ADAPTERS=memory CLIENT=selenium:firefox npm run test

Or append them as query params in the browser:

    http://localhost:8000/tests/index.html?adapters=memory

The `adapters` list is a comma-separated list that will be used for `PouchDB.preferredAdapters`.  So e.g. if you want to test `websql` in Chrome, you can do:

    http://localhost:8000/tests/index.html?adapters=websql

Or even make the `preferredAdapters` list anything you want:

    # loads websql, then memory, then idb, then localstorage
    http://localhost:8000/tests/index.html?adapters=websql,memory,idb,localstorage

Keep in mind that `preferredAdapters` only applies to non-http, non-https adapters.

### Installing a CouchDB server

Regular install
---------------------------

See the [official CouchDB documentation](http://docs.couchdb.org/en/1.6.1/install/index.html) for a guide on how to install CouchDB.
