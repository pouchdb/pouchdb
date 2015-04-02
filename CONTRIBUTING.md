[PouchDB](http://pouchdb.com/) - The JavaScript Database that Syncs
==================================================

Welcome, so you are thinking about contributing to PouchDB? awesome, this is a great place to start.

Get in Touch
------------

The following documentation should answer most of the common questions about how to get starting contributing, if you have any questions, please feel free to ask on the
[PouchDB Mailing List](https://groups.google.com/forum/#!forum/pouchdb) or in #pouchdb on irc.freenode.net.

Most project discussions should happen on the Mailing list / Bug Tracker and IRC, however if you are a first time contributor and want some help getting started feel free to send a private email to any of the following maintainers:

 * Dale Harvey (dale@arandomurl.com, daleharvey on IRC)
 * Nolan Lawson (nolan@nolanlawson.com, nolanlawson on IRC)
 * Calvin Metcalf (calvin.metcalf@gmail.com, calvinmetcalf on IRC)

#### PouchDB meeting

We hold a weekly 'office hours' meeting on IRC (irc.freenode.net#pouchdb) on Mondays at 5:00PM UTC (9:00 AM Pacific, 12:00 PM Eastern, 10:30 PM IST), this is open to anyone and a time when developers and users discuss issues they are having or working on.

Help Wanted
----------------

If you are looking for something to work on, we try to maintain a list of issues that should be suitable for first time contributions, they can be found tagged [help wanted](https://github.com/pouchdb/pouchdb/issues?labels=help%20wanted&state=open).

Guide to Contributions
--------------------------------------

  * Almost all Pull Requests for features or bug fixes will need tests
  * We follow [Felix's Node.js Style Guide](https://github.com/felixge/node-style-guide)
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

Testing PouchDB
--------------------------------------

Running PouchDB tests is really simple (5 minutes), go to [TESTING](./TESTING.md) for instructions.

Debugging PouchDB
--------------------------------------

PouchDB uses the `debug` [module](https://www.npmjs.org/package/debug) for debug
logging, to turn on the log output enable the debug flag in node:

    DEBUG=pouchdb:*

Or in the browser:

    PouchDB.debug.enable('pouchdb:*');

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
 * Ensure reviewed code follows the above contribution guidelines, if it doesn't feel free to amend and make note.
 * Please try to watch when Pull Requests are made and review and / or commit them in a timely manner.
 * After you merge in a patch use tin to update the version accordingly. Run `tin -v x.x.x-prerelease` with x.x.x being the previous version upgraded appropriately via semver. When we are ready to publish to npm we can remove the `-prerelease`.
 * Thanks, you are all awesome human beings.

Release Procedure
-----------------

 * Copy the last release post from ./docs/_posts/date-pouchdb-version.md, ammend date and version and fill in release notes
 * Push release post
 * `./node_modules/.bin/tin -v $VERSION`
 * Put the new version in `lib/version-browser.js` too
 * `npm run release`
 * Copy the `dist/pouchdb*` files from the $VERSION tag on github, paste the release notes and add the distribution files to Github Releases, rename `pouchdb.min.js` to `pouchdb-$VERSION.min.js` after you upload it.
 * `./node_modules/.bin/tin -v $VERSION+1-prerelease`
 * Put the new prerelease version in `lib/version-browser.js` too
 * Update docs/_config.yml to the current version
 * Push updated versions to master
 * `npm run publish-site`
