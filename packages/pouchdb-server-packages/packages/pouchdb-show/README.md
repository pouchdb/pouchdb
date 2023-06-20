pouchdb-show
============

A PouchDB plug-in that allows you to re-use your CouchDB show functions
on the client side. A browser version is available.

API
---

**NodeJS package name:** `pouchdb-show`

**Browser object name:** `window.Show`

First, make sure you understand how show functions work in CouchDB. A
good start is [the CouchDB guide entry on shows](http://guide.couchdb.org/draft/formats.html)

### Show.show(showPath[, options[, callback]])

Similar to the `List.list` function, but then for show
functions. Only differences are documented.

`showPath`: specifies the show (and optionally the document) to use.
Has the following form: `designDocName/showName[/docId]`

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
