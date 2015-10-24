How to contribute to pouchdb-find
=======

CouchDB setup
-------

For the HTTP tests you need the master branch of CouchDB running. See the CouchDB [Readme](https://github.com/apache/couchdb) for instructions on running.
Then setup a 1 node cluster for testing - `./dev/run --with-admin-party-please --with-haproxy -n 1`.
You will also need to enable cors on that node by running `./bin/enable-couchdb-cors.sh`.

Building
----
    npm install
    npm run build

Your plugin is now located at `dist/pouchdb.find.js` and `dist/pouchdb.find.min.js` and is ready for distribution.

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test

You can specify an alternate CouchDB server other than `http://localhost:5984`:

    COUCH_HOST=http://localhost:6984 npm test

You can also check for 100% code coverage using:

    npm run coverage

You can filter the tests by running:

    GREP=mysearch npm run test-node

### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`. The query param `couchHost=http://localhost:6984` will use a custom CouchDB server.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL. `COUCH_HOST` works here as well.
