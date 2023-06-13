Contributing
===

Want to contribute to PouchDB Server? Great, you've come to the right place!
This document contains everything you need to know to get started building,
testing, and publishing the code.

Monorepo
---

PouchDB Server is a monorepo, containing the packages `pouchdb-server` and `express-pouchdb`. It follows the same format as the [PouchDB monorepo](https://github.com/pouchdb/pouchdb), using the [alle](https://github.com/boennemann/alle) monorepo setup. You can read more about monorepos [here](https://github.com/babel/babel/blob/master/doc/design/monorepo.md) and [here](https://gist.github.com/nolanlawson/457cdb309c9ec5b39f0d420266a9faa4).

Conceptually `pouchdb-server` is a standalone CouchDB-esque server, whereas
`express-pouchdb` is designed to be injectable into an existing Express app.
`pouchdb-server` uses `express-pouchdb` under the hood.

Testing
---

One of the primary benefits of **pouchdb-server** is the ability to run PouchDB's Node test suite against itself. To do that, you can simply,

```bash
$ npm run test-pouchdb
```

Whatever args you provide as `SERVER_ARGS` will be passed to `pouchdb-server` itself:

```bash
$ SERVER_ARGS='--in-memory' npm run test-pouchdb
```

Or to test in Firefox (IndexedDB):

```bash
$ CLIENT=selenium:firefox npm run test-pouchdb
```

Or to test in PhantomJS (WebSQL):

```bash
$ CLIENT=selenium:phantomjs ES5_SHIM=true npm run test-pouchdb
```

Additionally, we've started porting CouchDB's JavaScript test harness to
[a simple Node module](https://github.com/nick-thompson/couchdb-harness), which can be run against PouchDB via **pouchdb-server**.

```bash
$ npm run test-couchdb
```

## Submitting a pull request

Want to help me make this thing awesome? Great! Here's how you should get started.

1. First, check whether your bugfix must be in `express-pouchdb` or `pouchdb-server`.
2. Make your changes on a separate branch whose name reflects your changes,
3. Run all tests to make sure your changes do not break anything
4. To create a PR, push your changes to your fork, and open a pull request!
5. For a PR, follow the commit message style guidelines in[PouchDB CONTRIBUTING.md](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

## Release process

`pouchdb-server` is a monorepo, meaning that when you publish, you need to publish all packages simultaneously. Versions are kept in sync across packages, for simplicity's sake.

Release process:

1. `npm version patch | minor | major` to change the version in the top-level `package.json`, which will apply to all packages in the release script
2. `git push origin master --tags`
3. `npm run release`

This will search through all the sub-packages and automatically figure out the correct `dependencies` and `optionalDependencies`. To add a new dependency, just add it to the top-level `package.json` and it will be identified at release time.