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


Good First Patch
----------------

If you are looking for something to work on, we try to maintain a list of issues that should be suitable for first time contributions, they can be found tagged [goodfirstpatch](https://github.com/daleharvey/pouchdb/issues?labels=goodfirstpatch&state=open).


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

Running PouchDB Tests
--------------------------------------

The PouchDB test suite expects an instance of CouchDB running in Admin Party on http://127.0.0.1:5984, you can configure this by sending the `COUCH_HOST` env var when running the Node tests or the `dev-server`

### Node Tests

Run all tests with:

    $ npm run test-node

Run an indivitual test:

    $ TEST_FILE=test.basics.js npm run test-node

### Browser Tests

Browser tests require a running HTTP server and a CORS proxy:

    $ npm run dev-server
    # or
    $ COUCH_HOST=http://user:pass@myname.host.com npm run dev-server

Now visit http://127.0.0.1:8000/tests/test.html in your browser, you can add ?grep=basics to run a test file. You do not need to manually rebuild PouchDB when you run the `dev-server` target, any changes you make to the source will automatically be built.

### All Tests

To run all tests:

    $ npm test

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

Building PouchDB Documentation
--------------------------------------

The source for the website http://pouchdb.com is stored inside the `docs` directory of the PouchDB repository, you can make changes and submit pull requests as with any other patch. To build and view the website locally you will need to install [jekyll](http://jekyllrb.com/) then:

    $ cd docs
    $ jekyll -w serve

You should now find the documentation at http://127.0.0.1:4000

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
