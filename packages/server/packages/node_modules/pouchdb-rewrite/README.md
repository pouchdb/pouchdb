pouchdb-rewrite
===============

A PouchDB plug-in that allows you to re-use your CouchDB rewrites on the
client side. A browser version is available.

API
---

**NodeJS package name:** `pouchdb-rewrite`

**Browser object name:** `window.Rewrite`

First, make sure you understand CouchDB rewrites. A good starting point
is [the rewrite documentation](http://docs.couchdb.org/en/latest/api/ddoc/rewrites.html).

### Rewrite.rewrite(rewritePath[, options[, callback]])

Figures out where to redirect to, and then executes the corresponding
PouchDB function, with the appropriate arguments gotten from the
request object that has been generated from the `options`
parameter.

`rewritePath`: a path of the form `"designDocName/rewrite/path"`. Specifies
the design document to use the rewrites from, and the path you'd find in
CouchDB after the `/_rewrite` part of the URL. Keep in mind that you can't
specify a query parameter in the url form (i.e. no `?a=b`). Instead use the
`options.query` parameter.

`options`: A CouchDB request object stub. Important properties of those for
rewrites are `options.query` and `options.method`. An additional boolean option
is available: `options.withValidation`, if true, this function routes to
`db.validating*` functions instead of `db.*` functions if relevant.

**Returns**: whatever output the function that the rewrite routed to produced.
Or, in the case of an 'http' database, a CouchDB response object.

### Rewrite.rewriteResultRequestObject(rewritePath[, options[, callback]])

See the `Rewrite.rewrite` function for information on the parameters.
The difference with it is that this function doesn't try to route the rewrite
to a function.

**Returns**: A CouchDB request object that points to the resource obtained by
following the redirect.

Source
------

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

License
-------

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
