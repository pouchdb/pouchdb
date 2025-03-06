# Running PouchDB Tests

This document covers all the types of tests the PouchDB project has and how to
run them. PouchDB has been primarily developed on Linux and macOS, if you are
using Windows then these instructions will have problems, we would love your
help fixing them though.


## Installation

The PouchDB test suite expects an instance of CouchDB (version 1.6.1 and above)
running in [Admin Party](http://guide.couchdb.org/draft/security.html#party) on
`http://127.0.0.1:5984` with [CORS
enabled](https://github.com/pouchdb/add-cors-to-couchdb). See the [official
CouchDB documentation](https://docs.couchdb.org/en/stable/install/index.html) for
a guide on how to install CouchDB.

If you have CouchDB available at a different URL, you can assign this URL to the
`COUCH_HOST` environment variable to make the PouchDB tests use it.

You can run CouchDB v3.0 or later, which no longer supports Admin Party, but you
will need to put user credentials in the `COUCH_HOST` URL to allow new databases
to be created, for example:

    COUCH_HOST='http://admin:password@localhost:5984'

If you use docker, you can start the CouchDB instance with:

    $ docker run -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password -it --name my-couchdb -p 5984:5984 couchdb:latest

    # to have a couchdb with enabled cors, you can use trivago/couchdb-cors
    $ docker run -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password -it --name my-couchdb -p 5984:5984 trivago/couchdb-cors:latest


## Running the integration tests

The main test suite can be run using the following command:

    $ npm test

PouchDB runs in the browser and on Node.js, and has multiple different storage
backends known as _adapters_. In the browser these are `idb`, `indexeddb` and
`memory` and on Node.js they're `leveldb` and `memory`.

It also includes an adapter named `http`, which works by delegating operations
to CouchDB (or anything that's API-compatible with it) over the network. Since
PouchDB replicates the functionality of CouchDB and speaks its replication
protocol, it's important we maintain compatibility with CouchDB and that all
tests pass against it. The variable `COUCH_HOST` sets the URL that PouchDB will
use to connect to a remote server.

By default, `npm test` will run the integration tests on Node.js, using the
default adapter for the target environment. Some of the tests perform
replication to a remote server, and by default we start an instance of
`pouchdb-express-router` for this purpose.

### Test options

The integration tests support the following options, configured via environment
variables.

#### `ADAPTERS` (default: depends on `CLIENT`)

Comma-separated list of preferred adapter backends that PouchDB will use for local
databases. These are selected automatically based on the execution environment,
but this variable overrides the default choice and causes additional adapters to
be loaded if they're not part of the default distribution.

On Node.js the available local adapters are `leveldb` and `memory`. In the
browser they're `idb`, `indexeddb` and `memory`.

You can also set `ADAPTERS=http` to force all PouchDB databases to be created on
a remote server, identified by `COUCH_HOST`. This is not necessary for
integration tests since they use a mixture of local and remote databases to
check compatibility, but it's useful for the `find` and `mapreduce` suites.

#### `AUTO_COMPACTION` (default: `0`)

Set this to `1` to enable automatic compaction of PouchDB databases by default.

#### `BAIL` (default: `1`)

Normally the test runner will halt as soon as it discovers a failing test. Set
this to `0` to prevent this behaviour.

#### `CLIENT` (default: `node`)

Sets the target platform the tests will execute on. Set this to
`firefox`, `chromium` or `webkit` to execute the tests in the browser.

#### `COUCH_HOST`

Some tests perform replication between local and remote databases. When we
create a remote database, we get the URL of the remote server from `COUCH_HOST`.
This variable must be set to the URL of a CouchDB-compatible HTTP server, with
CORS enabled.

If not set explicitly, this variable is set automatically based on the other
configuration values.

#### `FETCH` (default: `0`)

Set this to `1` to stop PouchDB falling back to `XMLHttpRequest` if `fetch()` is
not available.

#### `GREP`

Use this to request that a specific test is run; if you set `GREP='name of
test'` then only those tests whose names include the string `name of test` will
run.  Regular expressions are also supported.

#### `PLUGINS` (default: empty)

Comma-separated list of additional plugins that should be loaded into the test
environment. For example:

    $ PLUGINS=pouchdb-find npm test

#### `POUCHDB_SRC`

This overrides the path used to load PouchDB in the browser. We use this in CI
to select different builds of the PouchDB library, for example to test the
Webpack version, etc.

This is an alternative to `SRC_ROOT` and `USE_MINIFIED`.

#### `SRC_ROOT`

This overrides the path used to load all PouchDB files in the browser. We use
this in performance tests to allow easily comparing two different versions of
PouchDB, including plugin and adapter implementations.

#### `USE_MINIFIED`

This changes the file extension used for loading PouchDB files in the browser.
This can be used in CI and performance testing to select the minified version of
PouchDB and its adapters, plugins, etc.

#### `SERVER` (default: `pouchdb-express-router`)

To support remote replication tests, we start a server in the background that
speaks the CouchDB replication protocol. This variable controls how that is
done, and what `COUCH_HOST` is set to as a result. It can have one of the
following values:

- `pouchdb-express-router` (default): a minimal implementation of the CouchDB
  API that supports the replication protocol but not the `query()` or `find()`
  methods.
- `pouchdb-server`: this is a full reimplementation of the CouchDB API on top of
  PouchDB, including Mango and map-reduce queries.
- `couchdb-master`: use this value if you already have CouchDB running; it
  causes `COUCH_HOST` to be set to the correct value.

#### `SKIP_MIGRATION` (default: `0`)

Set this to `1` to skip the migration tests.

#### `VIEW_ADAPTERS` (default: `memory`)

Comma-separated list of preferred view adapter backends that PouchDB will use. 
This variable overrides the default choice and causes additional adapters to
be loaded if they're not part of the default distribution.

On Node.js the available adapters are `leveldb` and `memory`. In the
browser they're `idb`, `indexeddb` and `memory`.


## Other sets of tests

### `find` and `mapreduce`

The integration tests cover all the core functionality of CouchDB. Some
additional behaviour is covered by separate test suites, either because they
contain features not supported in every adapter, or because they take a long
time to run.

The main additional suites are the `find` and `mapreduce` suites, which can be
run using these commands:

    $ TYPE=find PLUGINS=pouchdb-find npm test
    $ TYPE=mapreduce npm test

These suites run all their tests against a single adapter per run; they will use
the default adapter for the target environment, which is Node.js by default.
These suites support most of the same options as the integration tests.

You'll want to test specific adapters by specifying them on the command-line,
for example:

    # run the "find" tests with the memory client on node.js
    $ TYPE=find PLUGINS=pouchdb-find CLIENT=node ADAPTERS=memory npm test

    # run the "mapreduce" tests with indexeddb in firefox
    $ TYPE=mapreduce CLIENT=firefox ADAPTERS=indexeddb npm test

It's also important to check these tests against server-side adapters,
specifically we need to ensure compatibility with CouchDB itself. We do this by
setting `ADAPTERS=http` and pointing `COUCH_HOST` at our server:

    $ TYPE=mapreduce ADAPTERS=http COUCH_HOST='<your CouchDB URL>' npm test

And we test [pouchdb-server](https://github.com/pouchdb/pouchdb-server) using
the current PouchDB source tree. This is an implementation of the CouchDB API
and supports the `find()` and `query()` methods. Run the test suites against it
like so:

    $ TYPE=mapreduce ADAPTERS=http SERVER=pouchdb-server npm test

Note that the default choice for the `SERVER` value (`pouchdb-express-router`)
does not support `find` or `mapreduce` and does not need to pass these tests.

### "Fuzzy" tests

This test suite checks some more unusual replication scenarios, it can be run
using the command:

    $ npm run test-fuzzy

### Performance tests

This suite checks some performance metrics.  It can be run using the command:

    $ TYPE=performance npm test

This supports most of the same options as the integration suite, particularly
the `CLIENT`, `ADAPTERS` and `GREP` options. It has some additional options of
its own:

#### `ITERATIONS`

Sets the number of iterations each test uses by default.

### Running tests in the browser

To run tests in the browser, you first have to install playwright:

```shell
npx playwright install
```

This will download the `firefox`, `chromium` and `webkit` `CLIENT`s onto
your system.

PouchDB is tested with `CLIENT=firefox`, `CLIENT=chromium` and `CLIENT=webkit`
to run a set of tests in the browser automatically. This runs these browsers
in a “headless” mode and prints the test results back into the terminal.

    $ CLIENT=firefox npm test

You can also run browser tests in a more "manual" fashion by running the dev
server and opening a browser window yourself. To run the server:

    $ npm run dev

Then you can open the page for any of the test suites via the following URLs:

- `http://127.0.0.1:8000/tests/integration/`
- `http://127.0.0.1:8000/tests/find/`
- `http://127.0.0.1:8000/tests/mapreduce/`
- `http://127.0.0.1:8000/tests/performance/`

The test options are controlled by editing the query string; some of the common
command-line options and their query string equivalents are:

| Environment variable | Query-string param |
| -------------------- | ------------------ |
| `ADAPTERS`           | `adapters`         |
| `AUTO_COMPACTION`    | `autoCompaction`   |
| `COUCH_HOST`         | `couchHost`        |
| `GREP`               | `grep`             |
| `ITERATIONS`         | `iterations`       |
| `PLUGINS`            | `plugins`          |
| `SRC_ROOT`           | `srcRoot`          |
| `POUCHDB_SRC`        | `src`              |
| `USE_MINIFIED`       | `useMinified`      |
| `VIEW_ADAPTERS`      | `viewAdapters`     |


## Other test tasks

There are a few other tasks we run during CI and which you will find useful to
run during development.

### `npm run eslint`

Checks that all code in the project follows our formatting and style guide. This
runs before any other tasks are run during our CI build.

### `npm run test-unit`

Runs the unit tests; running these can give more precise feedback about key
building blocks that are not working.

### `npm run test-component`

Tests some additional components besides the core database functionality, for
example authentication and read-only replication.

### `npm run test-coverage`

Runs the test suite with coverage analysis turned on.

### `npm run test-webpack`

Checks that the Webpack build of PouchDB works correctly.

### `npm run verify-build`

Checks that the build is correct.
