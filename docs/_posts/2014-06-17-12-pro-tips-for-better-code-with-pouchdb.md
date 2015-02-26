---
layout: post

title: 12 pro tips for better code with PouchDB

author: Nolan Lawson

---

This is not a blog post per se, but more of a list of tips and tricks to get the most out of your PouchDB experience.

There are a lot of PouchDB anti-patterns floating around out there on the Internet, and also some common pitfalls that can trip you up when you're new to the CouchDB API.  I see this stuff all the time on Stack Overflow, Twitter, and IRC, and it never ceases to amaze and horrify me. We need to do better.

So consider this your 12-step program to becoming a better PouchDB coder. Let's put these bad habits to bed.

### 1. Use put(), not post()

Never use `post()`.  You don't need it, so just stop.

Recall that `put()` requires you to supply your own doc ID, whereas `post()` generates a random one for you. However, this leads to inefficiencies, since you pay the cost of indexing a long ID like `'CB89021E-8439-392F-899C-054963FD0B9B'` without ever using it. 

Plus, you'll have to use `put()` anyway whenever you update or delete a document, so if you `post()`, you've got two APIs to learn instead of one. So remember: always `put()`, never `post()`.

### 2. Don't emit(doc.foo, doc)

Don't do:

```js
function (doc) {
  emit(doc.foo, doc);
}
```

Do:

```js
function (doc) {
  emit(doc.foo);
}
```

This anti-pattern is everywhere. It seems to date back to pre-PouchDB days, since it shows up in a lot of blog posts and articles about CouchDB.

Folks, you never need to `emit()` the full document in your map/reduce functions.  You can always just use `{include_docs: true}` when you query, and the freshest version of that document will be delivered right to your door.  Free of charge.

Plus, if you emit the full doc, then it will actually _serialize and write out that entire document to disk_.  This is true in both PouchDB and CouchDB, and it's pure waste.

So if you don't want big, inefficient map/reduce functions, then remember: only `emit()` what you need.

### 3. Don't emit(doc.foo, 1) and then _sum

Similar to the above, don't do:

```js
{
  map: 
    function (doc) {
      emit(doc.foo, 1);
    }.toString(),
  reduce: '_sum'
}
```

Do:

```js
{
  map: 
    function (doc) {
      emit(doc.foo);
    }.toString(),
  reduce: '_count'
}
```

You don't need to use `_sum` when a simple `_count` will do.

### 4. Attachments are overrated

{% include alert/start.html variant="warning" %}

<strong>Update:</strong> since this post was written, the stability and performance of attachments in PouchDB has greatly improved. Replicating large attachments is still not recommended, but attachments can be handy if used correctly. <a href='https://github.com/nolanlawson/blob-util'>blob-util</a> can help.

{% include alert/end.html %}

NPM has [moved away from storing attachments in CouchDB](http://blog.npmjs.org/post/71267056460/fastly-manta-loggly-and-couchdb-attachments). Nowadays they use a CDN for the binaries, and CouchDB just stores the metadata. In PouchDB, attachments have been [one](https://github.com/pouchdb/pouchdb/issues/2098) [of](https://github.com/pouchdb/pouchdb/pull/1078) [the](https://github.com/pouchdb/pouchdb/issues/1992) [biggest](https://github.com/pouchdb/pouchdb/issues/900) [sources](https://github.com/pouchdb/pouchdb/pull/2063) [of](https://github.com/pouchdb/pouchdb/pull/1210) [bugs](https://github.com/pouchdb/pouchdb/pull/502), since every browser seems to handle them differently. Plus, the [attachment API is hard to understand](https://github.com/pouchdb/pouchdb/issues/1251), you need [a Blob shim](https://gist.github.com/nolanlawson/10340255) for older browsers, and let's not even talk about ArrayBuffers, ArrayBufferViews, Uint8Arrays, and browsers that don't even support any of the above.

In general, both CouchDB and PouchDB are just poor fits for storing binary data.  (Databases rarely are.) Instead of attachments, try using a CDN or a simple fileserver, and store the URLs or checksums in the database if you need to.


<blockquote>

<p>
"One of the big things that everybody who's spent a lot of time with databases knows is that you should <em>never</em> put your binaries in the database.  It's a terrible idea.  It always goes wrong.  I have never met a database in 15 years of which it is not true, and it's definitely not true of CouchDB.
</p>

<p>
You are taking this thing which is meant to sort and organize data, and you're giving it binary data, which it can neither sort nor organize.  It can't do anything with that data, other than get really fat."
</p>

<footer>
<cite title="Source Title">
  Laurie Voss, on <a href='http://javascriptjabber.com/099-jsj-npm-inc-with-isaac-schlueter-laurie-voss-and-rod-boothby/'>JavaScript Jabber</a>
</cite>
</footer>

</blockquote>


### 5. Use plugins

[PouchDB has plugins](http://pouchdb.com/external.html).  Use them, and if inspiration ever strikes, [write your own](https://github.com/pouchdb/plugin-seed)!

### 6. Don't just update docs for the hell of it

Every time you modify a document, another revision is added to its revision history &ndash; think Git.  Except unlike Git, these revisions contain the full document data (not just the diffs), which can take up a lot of space on disk.  So if nothing changed in a document, don't bother `put()`ing it again.

### 7. Use and abuse your doc IDs

I already wrote [a blog post about this](http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html), but basically, if you don't want bad performance from your secondary indexes, the best strategy is to avoid secondary indexes altogether. The primary index should be sufficient for sorting and searching in nearly all of your applications, or at least for the hot-path code.

Also, if you really want to get fancy with your doc IDs, you can use [PouchDB Collate](https://github.com/pouchdb/collate/) to serialize arbitrary data into strings that are sorted according to [CouchDB collation ordering](https://wiki.apache.org/couchdb/View_collation).  This allows you to index on arrays, objects, numbers &ndash; whatever you want:

```js
var pouchCollate = require('pouchdb-collate');
var myDoc = {
  firstName: 'Scrooge',
  lastName: 'McDuck',
  age: 67,
  male: true
};
// sort by age, then gender, then last name, then first name
myDoc._id = pouchCollate.toIndexableString(
  [myDoc.age, myDoc.male, mydoc.lastName, mydoc.firstName]);
```

In the above example, the doc ID will be a crazy string, which will sort correctly in both CouchDB and PouchDB:

```js
'5323256.70000000000000017764\u000021\u00004McDuck\u00004Scrooge\u0000\u0000'
```

This is actually what persistent map/reduce uses under the hood!

And for cases where you only need to build complex IDs out of strings, there is also the fantastic [DocURI](https://github.com/jo/docuri) project, which can build a more human-readable ID like this:

```js
'movie/blade-runner/gallery-image/12/medium'
```

Choose whichever one fits your app better, or just concatenate the strings yourself.


### 8. Use Web SQL for better performance

{% include alert/start.html variant="warning" %}

<strong>Update:</strong> since this post was written, IndexedDB performance has improved, and is often better than WebSQL in Chrome. Your mileage may vary, so try them both out on your target platform(s).

{% include alert/end.html %}

Our performance tests have shown it again and again: Web SQL is faster than IndexedDB. It's hard to tell if that's due to our implementation or the browser vendors', but in any case, if you feel the need for speed, then you'll want to prefer Web SQL to IndexedDB.

So now that Android 4.4, iOS 8, and Safari 8 support IndexedDB in addition to Web SQL, it's more important than ever to consider using Web SQL instead of IndexedDB &ndash; at least, in apps where performance matters.  To do so, the code is simply:

```js
var pouch = new PouchDB('mydb', {adapter: 'websql'});
if (!pouch.adapter) { // websql not supported by this browser
  pouch = new PouchDB('mydb');
}
```

{% include alert/start.html variant="info" %}

<em>If Web SQL is so fast, why does PouchDB fall back to Web SQL from IndexedDB instead of the other way around?</em> Because we're trying to move the web forward, not rely on deprecated technology. If browser vendors can rest on their laurels with Web SQL, then they won't work to make IndexedDB faster.

{% include alert/end.html %}

### 9. Move logic from the map function to query()

If you only remember one thing from [my blog post about secondary indexes](http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html), remember this: every `map` function you write has to be executed for every single document in your database.  No exceptions.

On the other hand, the `query()` options like `startkey`, `endkey`, `key`, and `keys` have been optimized to hell, and they leverage the native indexes in the database to deliver the maximum possible performance.

So if you find yourself writing something like this, you're doing it wrong:

```js
function getPostsSince(when) {
  return db.query({
    map: function(doc, emit) {
      if (doc.timestamp > when) {
        emit(doc.name, 1);
      }
    },
  // ...
}
function getPostsBefore(when) {
  return db.query({
    map: function(doc, emit) {
      if (doc.timestamp < when) {
        emit(doc.name, 1);
      }
    }, 
  // ...
}
function getPostsBetween(startTime, endTime) {
  return db.query({
    map: function(doc, emit) {
      if (doc.timestamp > startTime && doc.timestamp < endTime) {
        emit(doc.name, 1);
      }
    }, 
  // ...
}
```

Each of those `db.query()` calls represents a separate _temporary index_. I.e., all your docs are read in, run through the map function, spit out to an index, queried, and then the whole thing is thrown away.  For every query!  This code is based on a real question I got from a developer on Twitter (sorry to pick on ya), and he described it as "crazy slow." No kidding.

Since all of these map/reduce functions key off of `doc.timestamp`, a better approach (which I recommended to him) would be:

```js
var ddoc = createDesignDoc('by_timestamp', function (doc) {
  emit(doc.timestamp, doc.name);
});
db.put(ddoc).then(function() {/* etc. */});

function getPostsSince(when) {
  return db.query('by_timestamp', {endkey: when, descending: true});
}
function getPostsBefore(when) {
  return db.query('by_timestamp', {startkey: when});
}
function getPostsBetween(startTime, endTime) {
  return db.query('by_timestamp', {startkey: startTime, endkey: endTime});
}
```

(That `createDesignDoc()` helper function comes from [this blost post](http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html).)

Not only is the above code much simpler, but it's also faster and more tweakable. No need to completely rebuild the index when your query changes; just switch around `startkey`/`endkey`/`descending` and friends at query time to get the data you want.

### 10. You probably don't need reduce

In the previous example, the developer was also doing some fancy operations on the data using `'_count'` and `'_sum'`.  Now, these are fine shortcuts that can save you a lot of code, but unless you're running your queries against the server, they don't buy you any performance benefits.

PouchDB runs in Node or the browser, meaning it's a single-threaded, single-process environment.  There's no massive parallelization of the map/reduce functions like you could get with CouchDB (or at least, BigCouch/Cloudant/Couchbase). So PouchDB takes a shortcut and just runs every `reduce` function in memory (there's no point in writing it to disk), meaning it's not doing anything you couldn't just do yourself.

So if you find yourself writing three different design documents that all `emit` the same thing but have different `reduce` functions: don't bother.  You can get better performance and smaller code by just writing a single design document with no `reduce`, and then doing the reduce yourself.

### 11. Debug with the CouchDB UI 

One common question is: How do I debug my database?  Well, that's easy: just replicate to CouchDB! Then you can browse your data in CouchDB's handy Futon interface.

In your code or in the browser console, just run:

```js
PouchDB.replicate('mydb', 'http://localhost:5984/mydb', {live: true});
```

Then open up [http://localhost:5984/_utils](http://localhost:5984/_utils). Or if you want to try the new Fauxton API in CouchDB 1.5: [http://localhost:5984/_utils/fauxton/](http://localhost:5984/_utils/fauxton/). You'll get a nice interface that looks like this:

{% include img.html src="fauxton.png" alt="Fauxton UI in PouchDB Server" %}

And if you don't feel like installing CouchDB, you can install [PouchDB Server](https://github.com/pouchdb/pouchdb-server) instead:

```
$ npm install -g pouchdb-server
$ pouchdb-server -p 5984
```

Then open up [http://localhost:5984/_utils](http://localhost:5984/_utils).


### 12. Contribute!

To paraphrase [Martin Fowler's famous talk](https://www.youtube.com/watch?v=qI_g07C_Q5I), part of the motivation behind the NoSQL movement was the collective realization by a generation of developers that, you know, this whole "database" thing? It isn't really that hard. Keys map to values, stuff's written to disk: it's a cinch once you learn the basics. And PouchDB occupies an even humbler niche in the NoSQL community, since our NoSQL database is actually built on other databases.

So if you find a bug, or if there's a missing feature you'd like to request, then check out the code and open a pull request!  We've got a very handsomely documented [contributor's guide](https://github.com/pouchdb/pouchdb/raw/master/CONTRIBUTING.md), and we're always happy to answer questions on [IRC](irc://freenode.net/#pouchdb), [Twitter](http://twitter.com/pouchdb), and [the mailing list](https://groups.google.com/forum/#!forum/pouchdb).

And even if you've committed the above errors (I know I have), we won't judge you too harshly.  If you've read this far, then you're already on the path to recovery.

### More tips

For more CouchDB tips in easily-digestible list format, check out Joan Touzet's awesome presentation: [10 Common Misconceptions about CouchDB](http://youtu.be/BKQ9kXKoHS8). And to see what you can get away with if you bend these rules a bit, watch [the talk that Nathan Vander Wilt gave](http://youtu.be/4QttTEbQ_1I) right after.
