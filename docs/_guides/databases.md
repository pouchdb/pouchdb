---
index: 4
layout: guide
title: Working with databases
sidebar: guides_nav.html
---

PouchDB databases come in two flavors: local and remote.

Local databases
--------

To create a local database, you simply call `new PouchDB` and give it a name:

```js
var db = new PouchDB('kittens');
```

You can see a **[live example](http://bl.ocks.org/nolanlawson/bddac54b92c2d8d39241)** of this code.

{% include alert/start.html variant="info" %}

<strong>Protip:</strong> whenever you see a live example in this guide, you can download it to follow along at home! For example, to run this example, just enter the following commands in your command prompt:
<p/>
<code>
<br/>git clone https://gist.github.com/bddac54b92c2d8d39241.git kittens
<br/>cd kittens
<br/>python -m SimpleHTTPServer
</code>
<p/>
Now the site is up and running at <a href='http://localhost:8000'>http://localhost:8000</a>. To find the correct <code>gist.github.com</code> URL, just click the "block" number at the top of the page.

{% include alert/end.html %}

Remote databases
--------

To create a remote database, you call `new PouchDB` and give it a path to a database in CouchDB.

```js
var db = new PouchDB('http://localhost:5984/kittens');
```

The structure of a CouchDB URL is very simple:

```
http://     localhost:5984     /kittens
⌞_____⌟     ⌞____________⌟      ⌞_____⌟
   |              |                |
Protocol     Where CouchDB       database
(https if    itself is           name
Cloudant)    hosted

```

If the remote database doesn't exist, then PouchDB will create it for you.

You can verify that your database is working by visiting the URL  [http://localhost:5984/kittens](http://localhost:5984/kittens).  You should see something like this:

```js
{"db_name":"kittens","doc_count":0,"doc_del_count":0,"update_seq":0,"purge_seq":0,"compact_running":false,"disk_size":79,"data_size":0,"instance_start_time":"1410722558431975","disk_format_version":6,"committed_update_seq":0}
```

If instead you see:

```js
{"error":"not_found","reason":"no_db_file"}
```

Then check to make sure that your remote CouchDB has started up correctly. Common errors (such as CORS) are [listed here](/errors.html).

Get basic info about the database
---------

You can see basic information about the database by using the `info()` method.

```js
db.info().then(function (info) {
  console.log(info);
})
```

The local database should show something like:

```js
{"doc_count":0,"update_seq":0,"db_name":"kittens"}
```

The remote database may have a bit more information:

```js
{"db_name":"kittens","doc_count":0,"doc_del_count":0,"update_seq":0,"purge_seq":0,"compact_running":false,"disk_size":79,"data_size":0,"instance_start_time":"1410722558431975","disk_format_version":6,"committed_update_seq":0}
```

The most important bits of information are:

* `doc_count`: the number of undeleted documents in the database
* `db_name`: the name of the database

Debugging
---------

When you create a PouchDB database, there are many ways to debug and inspect it.

### PouchDB Inspector

PouchDB Inspector is an add-on for Chrome and Firefox that allows you to inspect your local databases.

* [Download PouchDB Inspector for Chrome](https://chrome.google.com/webstore/detail/pouchdb-inspector/hbhhpaojmpfimakffndmpmpndcmonkfa)
* [Download PouchDB Inspector for Firefox](https://addons.mozilla.org/en-US/firefox/addon/pouchdb-inspector/)

{% include img.html src="pouchdb_inspector.png" alt="PouchDB Inspector in Chrome" %}

It provides the full "Fauxton" interface, which is the same interface you will see in CouchDB and PouchDB Server.

### IndexedDB/WebSQL inspectors

You can also use the normal developer tools to see what your database looks like under the hood.

In Chrome, just choose *Overflow icon* &#9776; &#8594; *Tools* &#8594; *Developer Tools*. Then click the *Resources* tab, then *IndexedDB*, and you should see the following:

{% include img.html src="dev_tools.png" alt="Chrome Developer Tools" %}

This is the raw IndexedDB representation of your PouchDB, so it is very fine-grained compared to what PouchDB Inspector shows. However, you may find it useful.

In Safari, your database will be under *Develop* &#8594; *Show Web Inspector* &#8594; *Resources* &#8594; *Databases*.

{% include img.html src="safari_inspector.png" alt="Web Inspector in Safari" %}

### Debug logging

You can also enable debug logging by doing:

```js
PouchDB.debug.enable('*');
```

And then disable it by doing:

```js
PouchDB.debug.disable();
```


Deleting your local database
----------------

During development, it's often useful to destroy the local database, so you can see what your users will experience when they visit your site for the first time. A page refresh is not enough, because the data will still be there!

In Chrome, you can use the [ClearBrowserData extension](https://chrome.google.com/webstore/detail/clearbrowserdata/apehfighfmpoieeniallefdeibodgmmb), which will add a trashcan icon to your toolbar, which you can click to delete all local data (IndexedDB, WebSQL, LocalStorage, cookies, etc.).

In Firefox, you can use the [Clear Recent History+ add-on](https://addons.mozilla.org/en-US/firefox/addon/clear-recent-history/), so when you right-click a page you can quickly clear all data.

In Safari, you can simply click *Safari* &#8594; *Clear History and Website Data*.

Differences between the local and remote databases
-------

When you create a local PouchDB database, it uses whatever underlying datastore is available - IndexedDB in most browsers, WebSQL in older browsers, and LevelDB in Node.js.

When you create a remote PouchDB database, it communicates directly with the remote database &ndash; CouchDB, Cloudant, Couchbase, etc.

The goal of PouchDB is to allow you to seamlessly communicate with one or the other. You should not notice many differences between the two, except that of course the local one is much faster!

Related API documentation
--------

* [new PouchDB() (constructor)](/api.html#create_database)
* [Debug mode](/api.html#debug_mode)
 
Next
-------

Now that you've created some databases, let's put some documents in 'em!
