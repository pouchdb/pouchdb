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

You can also test against phantomjs, but you'll need to install phantomjs yourself:

    $ npm install phantomjs-prebuilt
    $ CLIENT=selenium:phantomjs npm test

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

    $ npm run test-coverage

Again, this uses `npm run build-as-modular-es5` in order to fully test the codebase
as a non-bundle. See `build-as-modular-es5.sh` for details.

#### Test alternative server

    $ COUCH_HOST=http://user:pass@myname.host.com npm run dev

or

    $ COUCH_HOST=http://user:pass@myname.host.com npm test

#### Other test options

* `SKIP_MIGRATION=1` should be used to skip the migration tests.
* `NEXT=1` will test pouchdb-next (PouchDB with v2 IndexedDB adapter).
* `POUCHDB_SRC=../../dist/pouchdb.js` can be used to treat another file as the PouchDB source file.
* `npm run test-webpack` will build with Webpack and then test that in a browser.

#### Test against custom Firefox

You can specify a custom Firefox path using `FIREFOX_BIN`

    $ FIREFOX_BIN=/path/to/firefox npm run test-browser

#### Run the map/reduce tests

The map/reduce tests are done separately from the normal integration tests, because
they take a long time. They'll also cause a ton of popups in Safari due to exceeding
the 5MB limit.

    $ TYPE=mapreduce npm test

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

Note that you must `npm install pouchdb-server` or `npm install express-pouchdb` yourself for this test to work.

### Testing different Node adapters

Use this option to test the in-memory adapter:

    ADAPTER=memory

To run the node-websql test in Node, run the tests with:

    ADAPTER=websql

### Testing fetch vs XMLHttpRequest

PouchDB falls back to either XHR or fetch, whichever is available. You can test fetch-only using:

    FETCH=1 npm test

### Performance tests

To run the performance test suite in node.js:

    PERF=1 npm test

Or the automated browser runner:

    PERF=1 CLIENT=selenium:firefox npm test

You can also use `GREP` to run certain tests:

    PERF=1 GREP=basic-inserts npm test

You can also use `LEVEL_ADAPTER` to use a certain "DOWN" adapter:

    PERF=1 LEVEL_ADAPTER=memdown npm test

You can also test against node-websql:

    PERF=1 ADAPTER=websql npm test

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

### Build tests

To verify that the build was done correctly, there are some tests here:

    npm run verify-build

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
