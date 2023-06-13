pouchdb-list
============

A PouchDB plug-in that allows you to re-use your CouchDB list functions
on the client side. A browser version is available.

API
---

**NodeJS package name:** `pouchdb-list`

**Browser object name:** `window.List`

First, make sure you understand how list functions work in CouchDB. A
good start is [the CouchDB guide entry on lists](http://guide.couchdb.org/draft/transforming.html).

### List.list(listPath[, options[, callback]])

Runs a list function on a view. Both are specified via the `listPath` parameter.

`listPath`: a url of the form `"designDocName/listFuncName/viewName"`

`options`: this object is supplemented with defaults until a complete
[CouchDB request object](http://docs.couchdb.org/en/latest/json-structure.html#request-object)
has been formed, which is then passed into the list function.

**Returns**: When succesful, the list function's result in the form of a
[CouchDB response object](http://docs.couchdb.org/en/latest/json-structure.html#response-object).
Otherwise, an error object with one of the following statuses: 400, 404, 406
or 500.

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
