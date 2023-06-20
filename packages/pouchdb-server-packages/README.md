PouchDB Server [![Build Status](https://travis-ci.org/pouchdb/pouchdb-server.svg)](https://travis-ci.org/pouchdb/pouchdb-server) [![Greenkeeper badge](https://badges.greenkeeper.io/pouchdb/pouchdb-server.svg)](https://greenkeeper.io/)
=====

PouchDB Server is a drop-in replacement for CouchDB, using PouchDB and
Node.js. It is modeled after the single-node design of CouchDB 1.x,
although it contains some CouchDB 2.x features such as
[Mango queries](http://github.com/nolanlawson/pouchdb-find).

PouchDB Server is much less battle-tested than CouchDB, but it does pass the full [PouchDB test suite](https://github.com/pouchdb/pouchdb/tree/master/tests).

_For the `express-pouchdb` sub-package, skip to [express-pouchdb](#express-pouchdb)._

This git repository is a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md), and is the source for many [pouchdb npm packages](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).

For information about interacting with a PouchDB, see https://pouchdb.com/.

Usage
---

Install:

    npm install -g pouchdb-server

Then run:

    pouchdb-server

Now you can view the [Fauxton](https://github.com/apache/couchdb-fauxton) web
interface by opening `http://localhost:5984/_utils` in a browser.  

### Basic options

PouchDB Server's default port is 5984. To change it:

    pouchdb-server --port 3000

By default, all files are written in the current directory. To use another one:

    pouchdb-server --dir path/to/my/directory

PouchDB Server can run fully in-memory (no changes are saved):

    pouchdb-server --in-memory

Or it can run using SQLite rather than LevelDB:

    pouchdb-server --sqlite

### Full options

Most PouchDB Server options are available via the command line:

```
Usage: pouchdb-server [options]

Options:
   -p, --port             Port on which to run the server. (Defaults to
                          /_config/httpd/port which defaults to 5984).
   -d, --dir              Where to store database files. (Defaults to
                          /_config/couchdb/database_dir which defaults to the
                          current directory).
   -c, --config           The location of the configuration file that backs
                          /_config. (Defaults to ./config.json).
   -o, --host             The address to bind the server to. (Defaults to
                          /_config/httpd/bind_address which defaults to
                          127.0.0.1).
   -m, --in-memory        Use a pure in-memory database which will be deleted
                          upon restart. (Defaults to
                          /_config/pouchdb_server/in_memory which defaults to
                          false).
   --sqlite               Use PouchDB over SQLite instead of LevelDOWN.
                          (Defaults to /_config/pouchdb_server/sqlite which
                          defaults to false).
   -r, --proxy            Proxy requests to the specified host. Include a
                          trailing '/'. (Defaults to
                          /_config/pouchdb_server/proxy which defaults to
                          undefined).
   -n, --no-stdout-logs   Stops the log file from also being written to stdout.
                          (Defaults to /_config/pouchdb_server/no-stdout-logs
                          which defaults to false).
   --no-color             Disable coloring of logging output.
   --level-backend        Advanced - Alternate LevelDOWN backend (e.g. memdown,
                          riakdown, redisdown). Note that you'll need to
                          manually npm install it first. (Defaults to
                          /_config/pouchdb_server/level_backend which defaults
                          to undefined).
   --level-prefix         Advanced - Prefix to use for all database names,
                          useful for URLs in alternate backends, e.g.
                          riak://localhost:8087/ for riakdown. (Defaults to
                          /_config/pouchdb_server/level_prefix which defaults
                          to undefined).

Examples:

  pouchdb-server --level-backend riakdown --level-prefix riak://localhost:8087
  Starts up a pouchdb-server that talks to Riak.
  Requires: npm install riakdown

  pouchdb-server --level-backend redisdown
  Starts up a pouchdb-server that talks to Redis, on localhost:6379.
  Requires: npm install redisdown

  pouchdb-server --level-backend sqldown --level-prefix /tmp/
  Starts up a pouchdb-server using SQLite, with files stored in /tmp/.
  Requires: npm install sqldown sqlite3
```

### Configuration

By default, you can configure PouchDB Server using a `config.json` file, which is
typically expected at the root of wherever you run it, but may be specified with the `--config` option.

Below are some examples of `config.json` options:

#### log.level

To change the log output level, you can create a `config.json` file containing e.g.:

```json
{
  "log": {
    "level": "none"
  }
}
```

The available values are `debug`, `info`, `warning`, `error`, and `none`. The default
is `info`.

#### log.file

To choose the file where logs are written, you can create a `config.json` file containing e.g.:

```json
{
  "log": {
    "file": "/path/to/log.txt"
  }
}
```

By default, logs are written to `./log.txt`.

### Automatic port configuration

Due to conventions set by Heroku and others, if you have a `PORT` environment variable,
`pouchdb-server` will pick up on that and use it instead of `5984` as the default.

```bash
export PORT=3000
pouchdb-server # will run on port 3000
```

express-pouchdb
-----

The `express-pouchdb` module is a fully qualified [Express](http://expressjs.com/) application with routing defined to
mimic most of the [CouchDB](http://couchdb.apache.org/) REST API, and whose behavior is handled by
[PouchDB](http://pouchdb.com/).

The intention is for `express-pouchdb` to be mounted into Express apps for
extended usability. A simple example of this is
[pouchdb-server](https://github.com/pouchdb/pouchdb-server) itself.

### Usage

Install the necessary packages:

    npm install express-pouchdb pouchdb express

Now here's a sample Express app, which we'll name `app.js`.

```js
var PouchDB = require('pouchdb');
var express = require('express');
var app = express();

app.use('/db', require('express-pouchdb')(PouchDB));

app.listen(3000);
```

Now we can run this script and find each of `express-pouchdb`'s routes
at the `/db` path:

    node app.js &
    curl localhost:3000/db

You should see:

```json
{
    "express-pouchdb": "Welcome!",
    "uuid": "c0da32be-957f-4934-861f-d1e3ed10e544",
    "vendor": {
        "name": "PouchDB authors",
        "version": "2.2.6"
    },
    "version": "2.2.6"
}
```

*Note:* `express-pouchdb` conflicts with some middleware. You can work
around this by only enabling affected middleware for routes not handled
by `express-pouchdb`. [body-parser](https://www.npmjs.com/package/body-parser)
is the most important middleware known to be problematic.

#### API

`express-pouchdb` exports a single function that builds an express [application object](http://expressjs.com/4x/api.html#application). Its function signature is:

``require('express-pouchdb')([PouchDB[, options]])``
- ``PouchDB``: the PouchDB object used to access databases. Optional.
- ``options``: Optional. These options are supported:
 - ``configPath``: a path to the configuration file to use. Defaults to './config.json'.
 - ``logPath``: a path to the log file to use. Defaults to './log.txt'.
 - ``inMemoryConfig``: `true` if all configuration should be in-memory. Defaults to `false`.
 - ``mode``: determines which parts of the HTTP API express-pouchdb offers are enabled. There are three values:
   - ``'fullCouchDB'``: enables every part of the HTTP API, which makes express-pouchdb very close to a full CouchDB replacement. This is the default.
    - ``'minimumForPouchDB'``: just exposes parts of the HTTP API that map 1-1 to the PouchDB api. This is the minimum required to make the PouchDB test suite run, and a nice start when you just need an HTTP API to replicate with.
    - ``'custom'``: no parts of the HTTP API are enabled. You can add parts yourself using the ``opts.overrideMode`` discussed below.
  - ``overrideMode``: Sometimes the preprogrammed modes are insufficient for your needs, or you chose the ``'custom'`` mode. In that case, you can set this to an object. This object can have the following properties:
    - ``'include'``: a javascript array that specifies parts to include on top of the ones specified by ``opts.mode``. Optional.
    - ``'exclude'``: a javascript array that specifies parts to exclude from the ones specified by ``opts.mode``. Optional.

The application object returned contains some extra properties that
offer additional functionality compared to an ordinary express
application:

- ``setPouchDB``: a function that allows changing the ``PouchDB`` object `express-pouchdb` uses on the fly. Takes one argument: the new ``PouchDB`` object to use.
- ``couchConfig``: an object that provides programmatic access to the configuration file and HTTP API express-pouchdb offers. For an overview of available configuration options, take a look at Fauxton's configuration page. (``/_utils#_config``)
- ``couchLogger``: an object that provides programmatic access to the log file and HTTP API `express-pouchdb` offers.

#### Examples

##### Example 1

Builds an HTTP API that exposes a minimal HTTP interface, but adds
Fauxton as a debugging tool.

```javascript
var app = require('express-pouchdb')({
  mode: 'minimumForPouchDB',
  overrideMode: {
    include: ['routes/fauxton']
  }
});
// when not specifying PouchDB as an argument to the main function, you
// need to specify it like this before requests are routed to ``app``
app.setPouchDB(require('pouchdb'));
```

##### Example 2

builds a full HTTP API but excludes express-pouchdb's authentication
logic (say, because it interferes with custom authentication logic used
in our own express app):

```javascript
var app2 = require('express-pouchdb')(require('pouchdb'), {
  mode: 'fullCouchDB', // specified for clarity. It's the default so not necessary.
  overrideMode: {
    exclude: [
      'routes/authentication',
      // disabling the above, gives error messages which require you to disable the
      // following parts too. Which makes sense since they depend on it.
      'routes/authorization',
      'routes/session'
    ]
  }
});
```

#### Using your own PouchDB

Since you pass in the `PouchDB` that you would like to use with
`express-pouchdb`, you can drop `express-pouchdb` into an existing Node-based
PouchDB application and get all the benefits of the HTTP interface
without having to change your code.

```js
var express = require('express')
  , app     = express()
  , PouchDB = require('pouchdb');

app.use('/db', require('express-pouchdb')(PouchDB));

var myPouch = new PouchDB('foo');

// myPouch is now modifiable in your own code, and it's also
// available via HTTP at /db/foo
```

#### PouchDB defaults

When you use your own PouchDB code in tandem with `express-pouchdb`, the `PouchDB.defaults()` API can be very convenient for specifying some default settings for how PouchDB databases are created.

For instance, if you want to use an in-memory [MemDOWN](https://github.com/rvagg/memdown)-backed pouch, you can simply do:

```js
var InMemPouchDB = PouchDB.defaults({db: require('memdown')});

app.use('/db', require('express-pouchdb')(InMemPouchDB));

var myPouch = new InMemPouchDB('foo');
```

Similarly, if you want to place all database files in a folder other than the `pwd`, you can do:

```js
var TempPouchDB = PouchDB.defaults({prefix: '/tmp/my-temp-pouch/'});

app.use('/db', require('express-pouchdb')(TempPouchDB));

var myPouch = new TempPouchDB('foo');
```

If you want express-pouchdb to proxy requests to another CouchDB-style
HTTP API, you can use [http-pouchdb](https://www.npmjs.com/package/http-pouchdb):

```javascript
var TempPouchDB = require('http-pouchdb')(PouchDB, 'http://localhost:5984');
app.use('/db', require('express-pouchdb')(TempPouchDB));
```

#### Functionality

On top of the exposing everything PouchDB offers through a CouchDB-like
interface, `express-pouchdb` also offers the following extra
functionality found in CouchDB but not in PouchDB by default (depending
on the mode used, of course):

- [Fauxton][], a web interface for the HTTP API.
- [Authentication][] and [authorisation][] support. HTTP basic
  authentication and cookie authentication are available. Authorisation
  is handled by [validation functions][] and [security documents][].
- [Configuration][] support. You can modify configuration values
  manually in the `config.json` file, or use the HTTP or Fauxton
  interface.
- [Replicator database][] support. This allows your replications to
  persist past a restart of your application.
- Support for [show][], [list][] and [update][] functions. These allow
  you to serve non-json content straight from your database.
- [Rewrite][] and [Virtual Host][] support, for nicer urls.

[fauxton]:              https://www.npmjs.com/package/fauxton
[authentication]:       http://docs.couchdb.org/en/latest/intro/security.html
[authorisation]:        http://docs.couchdb.org/en/latest/intro/overview.html#security-and-validation
[validation functions]: http://docs.couchdb.org/en/latest/couchapp/ddocs.html#vdufun
[security documents]:   http://docs.couchdb.org/en/latest/api/database/security.html
[configuration]:        http://docs.couchdb.org/en/latest/config/intro.html#setting-parameters-via-the-http-api
[replicator database]:  http://docs.couchdb.org/en/latest/replication/replicator.html
[show]:                 http://guide.couchdb.org/editions/1/en/show.html
[list]:                 http://guide.couchdb.org/editions/1/en/transforming.html
[update]:               http://docs.couchdb.org/en/latest/couchapp/ddocs.html#update-functions
[rewrite]:              http://docs.couchdb.org/en/latest/api/ddoc/rewrites.html
[virtual host]:         http://docs.couchdb.org/en/latest/config/http.html#vhosts

Getting Help
------------

The PouchDB community is active [on Slack](http://slack.pouchdb.com/), [on Freenode IRC](https://www.irccloud.com/invite?channel=pouchdb&hostname=irc.freenode.net&port=6697&ssl=1), [Slack](http://slack.pouchdb.com),in [the Google Groups mailing list](https://groups.google.com/forum/#!forum/pouchdb), and [on StackOverflow](http://stackoverflow.com/questions/tagged/pouchdb). Or you can [tweet @pouchdb](http://twitter.com/pouchdb)!

If you think you've found a bug in PouchDB, please write a reproducible test case and file [a Github issue](https://github.com/pouchdb/pouchdb/issues). We recommend [bl.ocks.org](http://bl.ocks.org/) for code snippets, because some iframe-based services like JSFiddle and JSBin do not support IndexedDB in all browsers. You can start with [this template](https://gist.github.com/nolanlawson/816f138a51b86785d3e6).

## Contributing

See the [CONTRIBUTING.md](https://github.com/pouchdb/pouchdb-server/blob/master/CONTRIBUTING.md) file for how to get involved.

## Contributors

[These people](https://github.com/pouchdb/pouchdb-server/graphs/contributors) made PouchDB Server into what it is today!

## Changelog

`pouchdb-server` and `express-pouchdb` follow [semantic versioning](http://semver.org/). To see a changelog with all releases since v2.0.0, check out the [Github releases page](https://github.com/pouchdb/pouchdb-server/releases).

## License

The Apache 2 License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
