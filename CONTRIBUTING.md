[PouchDB](http://pouchdb.com/) - The JavaScript Database that Syncs
==================================================

Welcome, so you are thinking about contributing to PouchDB? awesome, this is a great place to start.

Get in Touch
------------

The following documentation should answer most of the common questions about how to get starting contributing, if you have any questions, please feel free to ask on the
[PouchDB Mailing List](https://groups.google.com/forum/#!forum/pouchdb) or in #pouchdb on irc.freenode.net.

Most project discussions should happen on the Mailing list / Bug Tracker and IRC, however if you are a first time contributor and want some help getting started feel free to send a private email to any of the following maintainers:

 * Dale Harvey (dale@arandomurl.com, daleharvey on IRC)
 * Calvin Metcalf (calvin.metcalf@gmail.com)


Help Wanted
----------------

If you are looking for something to work on, we try to maintain a list of issues that should be suitable for first time contributions, they can be found tagged [help wanted](https://github.com/pouchdb/pouchdb/issues?labels=help%20wanted&state=open).


Guide to Contributions
--------------------------------------

  * Almost all Pull Requests for features or bug fixes will need tests
  * We follow [Felix's Node.js Style Guide](http://nodeguide.com/style.html)
  * Almost all Pull Requests for features or bug fixes will need tests (seriously, its really important)
  * Before opening a pull request run `$ npm test` to lint test the changes and run node tests. Preferably run the browser tests as well.
  * Commit messages should follow the following style:

```
(#99) - A brief one line description < 50 chars

Followed by further explanation if needed, this should be wrapped at
around 72 characters. Most commits should reference an existing
issue
```

Dependencies
--------------------------------------

PouchDB needs the following to be able to build and test your build, if you haven't installed them then best to do do so now, we will wait.

  * [Node.js](http://nodejs.org/)
  * [CouchDB](http://couchdb.apache.org/)

Building PouchDB
--------------------------------------

All dependancies installed? great, now building PouchDB itself is a breeze:

    $ cd pouchdb
    $ npm install
    $ npm run build

You will now have various distributions of PouchDB in your `dist` folder, congratulations.

 * If you are on windows, you will need `node-gyp` to install levelup, visit https://github.com/TooTallNate/node-gyp#installation for installation instructions.

Running PouchDB Tests
--------------------------------------

The PouchDB test suite expects an instance of CouchDB running in Admin Party on http://127.0.0.1:5984, you can configure this by sending the `COUCH_HOST` env var.

 * PouchDB has been primarily developed on Linux and OSX, if you are using Windows then these instructions will have problems, we would love your help fixing them though.

### Node Tests

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

You may need to install `ant` in order for the Android tests to run (e.g. `brew install ant`).

You will also need to run the dev test `npm run dev` simultaneously, so that
the CORS server is available on port 2020.

    $ CLIENT=ios npm run cordova
    $ CLIENT=android DEVICE=true npm run cordova
    $ COUCH_HOST=http://myurl:2020 npm run cordova
    $ GREP=basics npm run cordova
    $ SQLITE_PLUGIN=true npm run cordova

* `CLIENT=ios` will run on iOS, default is `CLIENT=android`
* `DEVICE=true` will run on a device connected via USB, else on an emulator
* `SQLITE_PLUGIN=true` will use the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin)
* `COUCH_HOST` should be the full URL; you can only omit this is in the Android emulator

You can also debug with Weinre by doing:

    $ npm install -g weinre
    $ weinre --boundHost=0.0.0.0
    $ WEINRE_HOST=http://route.to.my.weinre:8080

The `ES5_SHIM=true` option is also available for Cordova.

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

Adapter plugins and adapter order
--------------------------------------

We are currently building three adapters-as-plugins: `memory`, `localstorage`, and `idb-alt`.  All are based on the [LevelDOWN API](https://github.com/rvagg/abstract-leveldown):

* `memory`: based on [MemDOWN](https://github.com/rvagg/memdown)
* `localstorage`: based on [localstorage-down](https://github.com/no9/localstorage-down)
* `idb-alt`: based on [level-js](https://github.com/maxogden/level.js), will probably replace `idb.js` someday

These adapters are built and included in the `dist/` folder as e.g. `pouchdb.memory.js`.  Including these scripts after `pouchdb-nightly.js` will load the adapters, placing them in the `PouchDB.preferredAdapters` list after `idb` and `websql` by default.

    <script src="pouchdb-nightly.js"></script>
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

Git Essentials
--------------------------------------

Workflows can vary, but here is a very simple workflow for contributing a bug fix:

    $ git clone git@github.com:myfork/pouchdb.git
    $ git remote add pouchdb https://github.com/pouchdb/pouchdb.git

    $ git checkout -b 121-issue-keyword master
    # Write tests + code
    $ git add src/afile.js
    $ git commit -m "(#121) - A brief description of what I changed"
    $ git push origin 121-issue-keyword

Building PouchDB Documentation
--------------------------------------

The source for the website http://pouchdb.com is stored inside the `docs` directory of the PouchDB repository, you can make changes and submit pull requests as with any other patch. To build and view the website locally you will need to install [jekyll](http://jekyllrb.com/) then:

    $ npm run build-site

You should now find the documentation at http://127.0.0.1:4000

Writing a PouchDB Blog Post
--------------------------------------

Writing a blog post for PouchDB is exactly the same process as other contributions, the blog posts are kept @ https://github.com/pouchdb/pouchdb/tree/master/docs/_posts, just build the site as documented above, its usually easiest to copy an existing post and write away.

If you want to be sure the blog post is relevant, open an issue on what you want to write about to hear back from reviewers.

Committers!
--------------

With great power comes great responsibility yada yada yada:

 * Code is peer reviewed, you should (almost) never push your own code.
 * Please don't accidentally force push to master.
 * Cherry Pick / Rebase commits, don't use the big green button.
 * Ensure reviewed code follows the above contribution guidelines, if it doest feel free to amend and make note.
 * Please try to watch when Pull Requests are made and review and / or commit them in a timely manner.
 * After you merge in a patch use tin to update the version accordingly. Run `tin -v x.x.x-prerelease` with x.x.x being the previous version upgraded appropriately via semver. When we are ready to publish to npm we can remove the `-prerelease`.
 * Thanks, you are all awesome human beings.

Release Procedure
-----------------

 * Copy the last release post from ./docs/_posts/date-pouchdb-version.md, ammend date and version and fill in release notes
 * Update docs/_config.yml to latest version
 * Push release post
 * `./node_modules/.bin/tin -v $VERSION
 * `npm run release`
 * Copy the `dist/pouchdb*` files from the $VERSION tag on github, paste the release notes and add the distribution files to Github Releases
 * `./node_modules/.bin/tin -v $VERSION+1-prerelease
 * Push updated versions to master
 * `npm run publish-site`
