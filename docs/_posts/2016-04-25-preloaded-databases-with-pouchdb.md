---
layout: post

title: Preloaded databases with PouchDB
author: Nolan Lawson

---

A common scenario when writing an app is that you have some data in a database,
but you want it to be immediately available when the app starts up. Your users
might be able to modify the data once it's loaded, but you want them to quickly start from a predetermined state.

PouchDB offers two ways to do this:

1. As a prebuilt SQLite file (appropriate for hybrid apps)
2. As a "dump" file (appropriate for web apps)

In this tutorial, I'll explain how to do both methods.

Prebuilt SQLite files
---

{% include alert/start.html variant="info" %}
{% markdown %}

**Note:** this method only works for hybrid apps, i.e. apps built with tools like Cordova,
PhoneGap, and Ionic.

{% endmarkdown %}
{% include alert/end.html %}

The advantage of bundling a SQLite file with your app is that the database is instantly
available. There's no need to load any data or write anything to disk; the SQLite
file is already ready for PouchDB to use.

### Creating the SQLite file

To start, we'll need some data. Let's say I have a CouchDB or PouchDB Server
database that looks like this:

{% include img.html src="turtles_db.png" alt="A database with some Teenage Mutant Ninja Turtles" %}

We have four documents in this databases, which I've named `turtles`.

Next, we need to convert this data into a SQLite file. If we started PouchDB Server like so:

```bash
$ pouchdb-server --sqlite
```

Then we're already done. There will be a file called `turtles` in the directory where we ran PouchDB Server, which is already a SQLite file.
You can verify yourself by opening it with the `sqlite3` command:

```
$ sqlite3 turtles
SQLite version 3.8.10.2 2015-05-20 18:17:19
Enter ".help" for usage hints.
sqlite> .tables
attach-seq-store  by-sequence       local-store
attach-store      document-store    metadata-store
sqlite> select * from 'by-sequence';
1|{"name":"Donatello","weapon":"bo","bandana":"purple"}|0|donatello|1-c2f9e6a91b946fb378d53c6a4dd6eaa2
2|{"name":"Leonardo","weapon":"katana","bandana":"blue"}|0|leonardo|1-c95202ca170be0318d085b33528f7995
3|{"name":"Michelangelo","weapon":"nunchaku","bandana":"orange"}|0|michelangelo|1-52ebc5a2f8dbc0dc247cd87213e742d1
4|{"name":"Raphael","weapon":"sai","bandana":"red"}|0|raphael|1-77812e9da146bc18a37e51efb063dbac
```

However, if you're not using PouchDB Server with the `--sqlite` option, then we'll need to use a more generic approach, which
can copy any CouchDB or PouchDB database to a SQLite file.

So let's write a short Node script to do that:

```js
// load PouchDB with the optional node-websql adapter
var PouchDB = require('pouchdb');
require('pouchdb/extras/websql');

// set up our databases - make sure the URL is correct!
var inputDB = new PouchDB('http://localhost:5984/turtles');
var outputDB = new PouchDB('turtles.db', {adapter: 'websql'});

// replicate
inputDB.replicate.to(outputDB);
```

If you haven't already, you'll need to install PouchDB in the directory where we'll run the script:

```bash
$ npm install pouchdb
```

Next, we'll run our script using:

```bash
$ node dump.js
```

If this works, you will have a file called `turtles.db` in the directory where you ran the script. (We're adding the `.db` extension, which is not strictly necessary, but is a common convention for SQLite files.)

You can still inspect the database file using the `sqlite3` command, as described above. Note that the tables
were built by PouchDB, though, and are not meant to be modified by hand.

### Bundling the SQLite file in your app

Now we'll want to bundle the SQLite database file in our app. To do so, we'll use
[SQLite Plugin 2](https://github.com/nolanlawson/cordova-plugin-sqlite-2) and follow
[the instructions for creating prepopulated databases](https://github.com/nolanlawson/cordova-plugin-sqlite-2#how-do-i-create-a-prepopulated-database).

If you don't already have it installed, install the `cordova` tool:
 
```bash
$ npm install -g cordova
```

Then create a new Cordova project:

```bash
$ cordova create pouchdb-prebuilt-demo
```

Next, we'll want to copy the `turtles.db` into the `www/` directory. This will ensure that the file
is bundled with the app.

When we copy the file, we'll also need to add a special prefix, `_pouch_`, so the final file
will be called `_pouch_turtles.db`. This `_pouch_` is a special
prefix that PouchDB uses when running in the browser, to avoid having its
namespace conflict with any other databases. In order for PouchDB
to find our database file, we'll need to be sure to add this prefix.

At this point, we'll also need to install some plugins for our Cordova app. In particular, we'll need the [File Plugin](https://github.com/apache/cordova-plugin-file)
and [SQLite Plugin 2](https://github.com/nolanlawson/cordova-plugin-sqlite-2). Inside of the `pouchdb-prebuilt-demo` directory, run:

```bash
$ cordova plugin add cordova-plugin-file --save
$ cordova plugin add cordova-plugin-sqlite-2 --save
```

We'll also need PouchDB itself. For expediency, let's just [download PouchDB](http://pouchdb.com/download.html)
and include `pouchdb.js` in the app, under `www/js`. Then we'll add it to `index.html`:

```html
<script src="js/pouchdb.js"></script>
```

Next, we'll need to write some code to copy the `turtles.db` file at runtime from the read-only `www/` directory
to a read-write directory. This is the only cost we pay at startup when using this approach, but it allows us to 
modify the database after it's been loaded.

Add this code to `www/js/index.js`, ensuring
that it runs after the `deviceready` event:

```js
// copy a database file from www/ in the app directory to the data directory
function copyDatabaseFile(dbName) {
  var sourceFileName = cordova.file.applicationDirectory + 'www/' + dbName;
  var targetDirName = cordova.file.dataDirectory;
  return Promise.all([
    new Promise(function (resolve, reject) {
      resolveLocalFileSystemURL(sourceFileName, resolve, reject);
    }),
    new Promise(function (resolve, reject) {
      resolveLocalFileSystemURL(targetDirName, resolve, reject);
    })
  ]).then(function (files) {
    var sourceFile = files[0];
    var targetDir = files[1];
    return new Promise(function (resolve, reject) {
      targetDir.getFile(dbName, {}, resolve, reject);
    }).catch(function () {
      return new Promise(function (resolve, reject) {
        sourceFile.copyTo(targetDir, dbName, resolve, reject);
      });
    });
  });
}

copyDatabaseFile('_pouch_turtles.db').then(function () {
  // database ready!
  var db = new PouchDB('turtles.db', {adapter: 'websql'});
  return db.allDocs({include_docs: true});
}).then(function (results) {
  var pre = document.createElement('pre');
  pre.innerHTML = JSON.stringify(results, null, '  ');
  document.body.appendChild(pre);
}).catch(console.log.bind(console));
```

Next, to run the app on Android, we can do:

```bash
$ cordova platform add android
$ cordova run android
```

Or on iOS:

```bash
$ cordova platform add ios
$ cordova run ios
```

If all goes well, you should see the following screens for Android and iOS:

{% include img.html src="prebuilt.png" alt="Prebuilt database app screenshot on iOS and Android" %}

The text in the background indicates that the database was preloaded and ready to go!

{% include alert/start.html variant="info" %}
{% markdown %}

**The full source code** for this example is available [on Github](https://github.com/nolanlawson/pouchdb-prebuilt-demo).

{% endmarkdown %}
{% include alert/end.html %}

Loading from a dump file
---

On the web, we don't have the luxury of prebuilt SQLite files, because WebSQL
isn't supported in every browser, and even those browsers with WebSQL don't support prebuilt files.

However, we can dump any PouchDB or CouchDB to a "dump file" using [pouchdb-dump-cli](https://github.com/nolanlawson/pouchdb-dump-cli).
This is less efficient than the prebuilt database (since PouchDB has to process the 
file and write the data to IndexedDB/WebSQL), but it gets the job done.

Going back to our "turtles" example, let's use `pouchdb-dump` to dump the contents
of the database to a plaintext dump file. First, install `pouchdb-dump-cli`:

```bash
$ npm install -g pouchdb-dump-cli
```

Then dump the database:

```bash
$ pouchdb-dump http://localhost:5984/turtles > turtles.txt
```

Now that we have a `turtles.txt` file, we can use the [pouchdb-load](https://github.com/nolanlawson/pouchdb-load)
plugin to load it into our database. Assuming the file is hosted on our web site, we can put this
in our HTML:

```html
<pre id="display"></pre>
<script src="pouchdb.js"></script>
<script src="pouchdb.load.js"></script>
<script>
  var db = new PouchDB('turtles');
  db.get('_local/preloaded').then(function (doc) {
  }).catch(function (err) {
    if (err.status !== 404) {
      throw err;
    }
    return db.load('turtles.txt').then(function () {
      return db.put({_id: '_local/preloaded'});
    });
  }).then(function () {
    return db.allDocs({include_docs: true});
  }).then(function (res) {
    display.innerHTML = JSON.stringify(res, null, '  ');
  }).catch(console.log.bind(console));
</script>
```

This will fetch the `turtles.txt` file via AJAX and then load it into PouchDB. A special `_local` document
lets us know if we've already loaded it, in which case we can skip that step.

If this works, you should see the four turtle documents printed to the screen, since they 
were successfully loaded from the dump file.

{% include alert/start.html variant="info" %}
{% markdown %}

**The full source code** for this example is available in [this Gist](http://bl.ocks.org/nolanlawson/5100ca90dc1028d811a2b5c73119e323).

{% endmarkdown %}
{% include alert/end.html %}

Wrapping up
---

Prebuilding a database can be a nice way to speed up the initial load of your
app or web site. However, it is an optimization, so it takes a little bit of
extra work to get it up and running.

For the average use case, if you can avoid any complicated prebuild steps and simply
replicate between CouchDB and PouchDB via the normal `replicate()` and `sync()` APIs,
you should. In fact, CouchDB's replication is slated to speed up dramatically
with v2.0 and v1.7, thanks to the new [\_bulk\_get endpoint](https://issues.apache.org/jira/browse/COUCHDB-2310).
When that feature lands, you may find that `pouchdb-load` isn't significantly
more performant than just replicating directly from CouchDB. (Prebuilt SQLite files, however, are likely
to remain much more performant.)

Hopefully this tutorial was useful for anybody struggling to get preloaded PouchDB databases into their app.
If not, feel free to [get in touch](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md#get-in-touch) anytime!