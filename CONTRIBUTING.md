[PouchDB](http://pouchdb.com/) - The Javascript Database that Syncs
==================================================

Welcome, so you are thinking about contributing to PouchDB? awesome, this is a great place to start.

Guide to Contributions
--------------------------------------

  * Almost all Pull Requests for features or bug fixes will need tests
  * Looking for something to work on? look for bugs marked [goodfirstbug](https://github.com/daleharvey/pouchdb/issues?labels=goodfirstbug&page=1&state=open)
  * We follow [Felix's Node.js Style Guide](http://nodeguide.com/style.html)
  * Almost all Pull Requests for features or bug fixes will need tests (seriously, its really important)
  * Before opening a pull request run `$ grunt test` to lint test the changes and run node tests. Preferably run the browser tests as well.
  * Commit messages should follow the following style:

```
(#99) - A brief one line description < 50 chars

Followed by further explanation if needed, this should be wrapped at
around 72 characters. Most commits should reference an existing
issue
```

Dependencies
--------------------------------------

PouchDB needs the following to be able to build and test your build, if you havent installed them then best to do do so now, we will wait.

  * [Node.js](http://nodejs.org/)
  * [CouchDB](http://couchdb.apache.org/)

Building PouchDB
--------------------------------------

All dependancies installed? great, now building PouchDB itself is a breeze:

    $ cd pouchdb
    $ npm install -g grunt-cli
    $ npm install
    $ grunt

You will now have various distributions of PouchDB in your `dist` folder, congratulations.

Running PouchDB Tests
--------------------------------------

The PouchDB test suite expects an instance of CouchDB running on http://127.0.0.1:5984 and it will need to be in Admin Party.

### Node Tests

Run all tests with:

    $ grunt node-qunit

Run single test file `test.basics.js` with:

    $ grunt node-qunit --test=basics

### Browser Tests

    $ grunt browser
    # Now visit http://127.0.0.1:8000/tests/test.html in your browser
    # add ?testFiles=test.basics.js to run single test file

Git Essentials
--------------------------------------

Workflows can vary, but here is a very simple workflow for contributing a bug fix:

    $ git clone git@github.com:myfork/pouchdb.git
    $ git remote add pouchdb https://github.com/daleharvey/pouchdb.git

    $ git checkout -b 121-issue-keyword master
    # Write tests + code
    $ git add src/afile.js
    $ git commit -m "(#121) - A brief description of what I changed"
    $ git push origin 121-issue-keyword

Questions?
----------

If you have any questions, please feel free to ask on the
[PouchDB Mailing List](https://groups.google.com/forum/#!forum/pouchdb) or in #pouchdb on irc.freenode.net.
