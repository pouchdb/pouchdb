---
layout: post

title: Secondary indexes have landed in PouchDB

author: Nolan Lawson

---

With the release of PouchDB 2.2.0, we're happy to introduce a feature that's been cooking on the slow simmer for some time: secondary indexes, a.k.a. persistent map/reduce.

This is a powerful new tool for developers, since it allows you to index anything in your JSON documents &ndash; not just the doc IDs. Starting in 2.2.0, your data is sortable and searchable in ways that just weren't feasible before, thanks to a new cross-platform indexing engine we've built to work with every supported backend - IndexedDB, WebSQL, and LevelDB (and soon: LocalStorage!).

As usual with PouchDB, the new API is modeled after CouchDB's.  So developers who are already familiar with the [CouchDB map/reduce API](https://wiki.apache.org/couchdb/HTTP_view_API) will be up and running in no time.  

And did I mention?  It's fast.  Our [performance tests](https://gist.github.com/nolanlawson/11100235) show that the new persistent map/reduce API could give you orders of magnitude improvements over the old on-the-fly `query()` method.  In a database containing 1,000 documents, we found queries in PouchDB 2.2.0 to be between 10 and 100 times faster than in PouchDB 2.1.2.

Show me the code!
-----

Here's the old way to query:

```js
var pouch = new PouchDB('mydb');

// temporary view, each doc is processed in-memory (slow)
pouch.query(function (doc) {
  emit(doc.name);
}, {key: 'foo'}).then(function (result) {
  // found docs with name === 'foo'
});
```

{% include alert/start.html variant="info" %}

The <code>emit</code> pattern is part of the standard <a href='http://couchdb.readthedocs.org/en/latest/couchapp/views/intro.html'>CouchDB map/reduce API</a>.  What the function basically says is, "for each document, emit <code>doc.name</code> as a key."

{% include alert/end.html %}

And here's the new way:

```js
// document that tells PouchDB/CouchDB
// to build up an index on doc.name
var myIndex = {
  _id: '_design/my_index',
  views: {
    'my_index': {
      map: function (doc) { emit(doc.name); }.toString()
    }
  }
};
// save it
pouch.put(myIndex).then(function () {
  // kick off an initial build, return immediately
  return pouch.query('my_index', {stale: 'update_after'});
}).then(function () {
  // query the index (much faster now!)
  return pouch.query('my_index', {key: 'foo'});
}).then(function (result) {
  // found docs with name === 'foo'
});
```

Ew, you put map/reduce in my JavaScript?
------------

First, let's define what map/reduce is, so you can understand why you might want it.

#### Indexes in SQL databases

Quick refresher on how indexes work: in relational databases like MySQL and PostgreSQL, you can usually query whatever field you want:

```sql
SELECT * FROM pokemon WHERE name = 'Pikachu';
```
    
But if you don't want your performance to be terrible, you first add an index:

```sql
ALTER TABLE pokemon ADD INDEX myIndex ON (name);
```
    
The job of the index is to ensure the field is stored in a B-tree within the database, so your queries run in _O(log(n))_ time instead of _O(n)_ time.

#### Indexes in NoSQL databases

All of the above is also true in document stores like CouchDB and MongoDB, but conceptually it's a little different. By default, documents are assumed to be schemaless blobs with one primary key (called `_id` in both Mongo and Couch), and any other keys need to be specified separately.  The concepts are largely the same; it's mostly just the vocabulary that's different.

In CouchDB, queries are called _map/reduce functions_.  This is because, like most NoSQL databases, CouchDB is designed to scale well across multiple computers, and to perform efficient query operations in parallel. Basically, the idea is that you divide your query into a _map_ function and a _reduce_ function, each of which may be executed in parallel in a multi-node cluster.

#### Map functions

It may sound daunting at first, but in the simplest (and most common) case, you only need the _map_ function.  A basic map function might look like this:

```js
function myMapFunction(doc) {
  emit(doc.name);
}
```  

This is functionally equivalent to the SQL index given above.  What it essentially says is: "for each document in the database, emit its name as a key."

And since it's just JavaScript, you're allowed to get as fancy as you want here:

```js
function myMapFunction(doc) {
  if (doc.type === 'pokemon') {
    if (doc.name === 'Pikachu') {
      emit('Pika pi!');
    } else {
      emit(name);
    }
  }
}
```

Then you can query it:

```js
// find pokemon with name === 'Pika pi!'
pouch.query(myMapFunction, {key: 'Pika pi!', include_docs: true}).then(function (result) {
  // handle result
});

// find the first 5 pokemon whose name starts with 'P'
pouch.query(myMapFunction, {
  startkey: 'P', endkey: 'P\uffff', limit: 5, include_docs: true
}).then(function (result) {
  // handle result
});
```

{% include alert/start.html variant="info"%}

The pagination options for <code>query()</code> &ndash; i.e., <code>startkey</code>/<code>endkey</code>/<code>key</code>/<code>keys</code>/<code>skip</code>/<code>limit</code>/<code>descending</code> &ndash; are exactly the same as with <code>allDocs()</code>. For a beginner's guide to pagination, read <a href='http://pouchdb.com/2014/04/14/pagination-strategies-with-pouchdb.html'>Pagination strategies with PouchDB</a>.

{% include alert/end.html %}

#### Reduce functions

As for _reduce_ functions, there are a few handy built-ins that do aggregate operations (`'_sum'`, `'_count'`, and `'_stats'`), and you can typically steer clear of trying to write your own:

```js
// emit the first letter of each pokemon's name
var myMapReduceFun = {
  map: function (doc) {
    emit(doc.name.charAt(0));
  },
  reduce: '_count'
};
// count the pokemon whose names start with 'P'
pouch.query(myMapReduceFun, {
  key: 'P', reduce: true, group: true
}).then(function (result) {
  // handle result
});
```

If you're adventurous, though, you should check out the [CouchDB documentation](http://couchdb.readthedocs.org/en/latest/couchapp/views/intro.html) or the [PouchDB documentation](http://pouchdb.com/api.html#query_database) for details on reduce functions.

Map/reduce, reuse, recycle
----------

PouchDB has actually had map/reduce queries since way before version 2.2.0, via the `query()` API. It had a big flaw, though: all queries were performed in-memory, reading in every document in the entire database just to perform a single operation.

This is fine when your data set is small, but it could be murder on large databases. On mobile devices especially, memory is a precious commodity, so you want to be as frugal as possible with the resources given to you by the OS.

The new persistent `query()` method is much more memory-efficient, and it won't read in the entire database unless you tell it to.  It has two modes:

* Temporary views (like the old system)
* Persistent views (new system)

Both of these concepts exist in CouchDB, and they're faithfully emulated in PouchDB.

#### A room with a view

First off, some vocabulary: CouchDB calls indexes _views_, and these views are stored in a special document called a _design document_. Basically, a design document describes a view, and a view describes a map/reduce query, which tells the database that you plan to use that query later, so it better start indexing it now. In other words, creating a view is the same as saying `CREATE INDEX` in a SQL database.

**Temporary views** are exactly that &ndash; temporary. Instead of using a design document, you just call `pouch.query()`, so the view is created, written to disk, queried, and then poof, it's deleted.  That's why, in older version of PouchDB, we could get away with doing it all in-memory.

Crucially, though, temporary views have to do a full scan of all documents _every time you execute them_, along with all the reading and writing to disk that that entails, only to throw it away at the end.  That may be fine for quick testing during development, but in production it can be a big drag on performance.

**Persistent views**, on the other hand, are a much better solution if you want your queries to be fast.  Persistent views need to be saved in a design document (hence "persistent"), so that the emitted fields are already indexed by the time you look them up.  Subsequent lookups don't need to do any additional writes to disk, unless documents have been added or modified, in which case only the updated documents need to be processed.

{% include alert/start.html variant="info"%}

<strong>Why design docs?</strong> <a href='http://guide.couchdb.org/draft/design.html'>Design documents</a> are special meta-documents that CouchDB uses for things like indexes, security, and schema validation (think: "designing" your database).  They are stored, updated, and deleted exactly like normal documents, but their <code>_id</code>s are prefixed with the reserved string <code>'_design/'</code>.  They also show up in <code>allDocs()</code> queries, but you can filter them out by using <code>{startkey: '_design0'}</code>.

{% include alert/end.html %}

#### Writing your first view

A design document with a view looks just like a regular document.  The simplest one might look like this:

```js
var designDoc = {
  _id: '_design/my_index',
  views: {
    'my_index': {
      map: function(doc) {
        emit(doc.name);
      }.toString()
    }
  }
};
```

All you need to do is `put()` this document into your database:

```js
pouch.put(designDoc).then(function (info) {
 // design doc created
}).catch(function (err) {
  // if err.name === 'conflict', then
  // design doc already exists
});
```

&hellip; and then it will be available for querying using the name `'my_index'`:

```js
pouch.query('my_index').then(function(result) {
 // do something with result
});
```

Whatever name you give, be sure to use the same one in both the `_id` (after `'_design/'`) and in the `views`; otherwise you will need to use the awkward format `'my_design_doc_name/my_view_name'` when you query.

{% include alert/start.html variant="info"%}

Technically, a design doc can contain multiple views, but there's really no advantage to this. Plus, it can even cause performance problems in CouchDB, since all the indexes are written to a single file. So we recommend that you create one view per design doc, and use the same name for both, in order to make things simpler.

{% include alert/end.html %}

Since there's a lot of boilerplate involved in creating views, you can use the following helper function to create a simple design doc based on a name and a map function:

```js
function createDesignDoc(name, mapFunction) {
  var ddoc = {
    _id: '_design/' + name,
    views: {
    }
  };
  ddoc.views[name] = { map: mapFunction.toString() };
  return ddoc;
}
```

Then you just need to `put()` it:

```js
var designDoc = createDesignDoc('my_index', function (doc) {
  emit(doc.name);
});
pouch.put(designDoc).then(function (doc) {
  // design doc created!
}).catch(function (err) {
  // if err.name === 'conflict', then
  // design doc already exists
});
```

From now on, you can call `pouch.query('my_index')` and it will summon this design document for querying.

Just like regular documents, design docs can always be deleted or changed later. The index will be updated automatically the next time you `query()` it.

If you do this a lot, though, then old indexes will build up on disk.  You can call `pouch.viewCleanup()` to clean up any orphaned indexes. 

{% include alert/start.html variant="warning"%}

<strong>Performance tip</strong>: Technically, the view will not be built up on disk until the first time you <code>query()</code> it.  So a good trick is to always call <code>query(viewName, {stale: 'update_after'})</code> after creating a view, to ensure that it starts building in the background.  You can also use <code>{stale: 'ok'}</code> to avoid waiting for the most up-to-date results. In the future, we may add an API for auto-updating.

{% include alert/end.html %}

#### For those who get nostalgic

Of course, some of our loyal Pouchinistas may have been perfectly happy with the old way of doing things. The fact that the old `query()` function slurped the entire database into memory might have served them just fine, thank you.

To be sure, there are some legitimate use cases for this. If you don't store a lot of data, or if all your users are on desktop computers, or if you require closures (not supported by persistent views), then doing map/reduce in memory may have been fine for you. In fact, an upgrade to 2.2.0 might actually make your app _slower_, because now it has to read and write to disk.

Luckily we have a great solution for you: instead of using the `query()` API, you can use the much more straightforward `allDocs()` API.  This will read all documents into memory, just like before, but best of all, you can apply whatever functions you want to the data, without having to bother with learning a new API or even what the heck "map/reduce" is.

But in general, we strongly recommend upgrading your apps to the new API instead.

When *not* to use map/reduce
----

Now that I've sold you on how awesome map/reduce is, let's talk about the situations where you might want to avoid it.

First off, you may have noticed that the CouchDB map/reduce API is pretty daunting.  As a newbie Couch user who very recently struggled with the API, I can empathize: the vocabulary is new, the concepts are (probably) new, and there's no easy way to learn it, except to clack at your keyboard for awhile and try it out.

Second off, views can take awhile to build up, both in CouchDB and PouchDB. Each document has to be fetched from the database, passed through the map function, and indexed, which is a costly procedure for large databases. And if your database is constantly changing, you will also incur the penalty at `query()` time of running the map function over the changed documents.

Luckily, it turns out that the primary index, `_id`, is often good enough for a variety of querying and sorting operations. So if you're clever about how you name your document `_id`s, you can avoid using map/reduce altogether.

For instance, say your documents are emails that you want to sort by recency: boom, just set the `_id` to `new Date().toJSON()`.  Or say they're web pages that you want to look up by URL: use the URL itself as the `_id`! Neither CouchDB nor PouchDB have a limit on how long your `_id`s can be, so you can get as fancy as you want with this.

#### Use and abuse your doc IDs

For a more elaborate example, let's imagine you're writing a music app.  Your database might contain artists:

```js
[ { _id: 'artist_bowie',
    type: 'artist',
    name: 'David Bowie',
    age: 67 },
  { _id: 'artist_dylan',
    type: 'artist',
    name: 'Bob Dylan',
    age: 72 },
  { _id: 'artist_joni',
    type: 'artist',
    name: 'Joni Mitchell',
    age: 70 } ]
```

&hellip; as well as albums:

```js
[ { _id: 'album_bowie_1971_hunky_dory',
    artist: 'artist_bowie',
    title: 'Hunky Dory',
    type: 'album',
    year: 1971 },
  { _id: 'album_bowie_1972_ziggy_stardust',
    artist: 'artist_bowie',
    title: 'The Rise and Fall of Ziggy Stardust and the Spiders from Mars',
    type: 'album',
    year: 1972 },
  { _id: 'album_dylan_1964_times_they_are_changin',
    artist: 'artist_dylan',
    title: 'The Times They Are a-Changin\'',
    type: 'album',
    year: 1964 },
  { _id: 'album_dylan_1965_highway_61',
    artist: 'artist_dylan',
    title: 'Highway 61 Revisited',
    type: 'album',
    year: 1965 },
  { _id: 'album_dylan_1969_nashville_skyline',
    artist: 'artist_dylan',
    title: 'Nashville Skyline',
    type: 'album',
    year: 1969 },
  { _id: 'album_joni_1974_court_and_spark',
    artist: 'artist_joni',
    title: 'Court and Spark',
    type: 'album',
    year: 1974 } ]
```

See what I did there? Artist-type documents are prefixed with `'artist_'`, and album-type documents are prefixed with `'album_'`.  This naming scheme is clever enough that we can already do lots of complex queries using `allDocs()`, even though we're storing two different types of documents.

Want to find all artists?  It's just:

```js
allDocs({startkey: 'artist_', endkey: 'artist_\uffff'});
```  

Want to list all the albums?  Try:

```js
allDocs({startkey: 'album_', endkey: 'album_\uffff'});
```

How about all albums by David Bowie?  Wham bam, thank you ma'am:

```js
allDocs({startkey: 'album_bowie_', endkey: 'album_bowie_\uffff'});
```

Let's go even fancier. Can we find all of Bob Dylan's albums released between 1964 and 1965, in reverse order? Gather 'round people, and try this:

```js
allDocs({startkey: 'album_dylan_1965_', endkey: 'album_dylan_1964_\uffff', descending: true});
```

In this example, you're getting all those "indexes" for free, each time a document is added to the database.  It doesn't take up any additional space on disk compared to the randomly-generated UUIDs, and you don't have to wait for a view to get built up, nor do you have to understand the map/reduce API at all.

Of course, this system starts to get shaky when you need to search by a variety of criteria: e.g. all albums sorted by year, artists sorted by age, etc. And you can only sort strings &ndash; not numbers, booleans, arrays, or arbitrary JSON objects, like the map/reduce API supports.  But for a lot of simple applications, you can get by without using the `query()` API at all.

{% include alert/start.html variant="warning"%}

<strong>Performance tip</strong>: if you're just using the randomly-generated doc IDs, then you're not only missing out on an opportunity to get a free index &ndash; you're also incurring the overhead of building an index you're never going to use. So use and abuse your doc IDs!

{% include alert/end.html %}

Tips for writing views
-----

When you do need the full map/reduce API, though, it pays to know the tips and tricks.  Below is a list of advanced techniques and common pitfalls, which you may find useful when you're trying to squeeze that last bit of performance out of your views.

**1. Don't index it if you don't need it**

If your database has several document types, but only the "person" type has a `lastName` field, do this:

```js
function (doc) {
  if (doc.lastName) {
    emit(doc.lastName);
  }
}
```

If you took out the `if` statement, you'd emit a `null` key for every non-person in your database, which needlessly bloats the size of your index.

{% include alert/start.html variant="info"%}

If the <code>null</code> field is meaningful for some reason, though, you can emit it and look it up later using <code>query(viewName, {key: null})</code>.  Any <code>undefined</code> fields are treated as <code>null</code>.

{% include alert/end.html %}
 
**2. Move logic to the query params**

Don't do:

```js
function (doc) {
  if (doc.highScore >= 1000) {
    emit(doc.highScore);
  }
}
```

Instead, do:

```js
function (doc) {
  emit(doc.highScore);
}
```

And then query with `{startkey: 1000}`.

**3. Use high characters for prefix search**

To find every `lastName` that starts with an `'L'`, you can use the high Unicode character `'\uffff'`:

```js
pouch.query(viewName, {startkey: 'L', endkey: 'L\uffff'});
```

Or you can set `inclusive_end` to `false`:

```js
pouch.query(viewName, {startkey: 'L', endkey: 'M', inclusive_end: false});
```

Both queries will do the same thing.

**4. Use {} for complex key ranges**

If your keys are `[lastName, firstName]`, and you need to find everybody with the last name `'Harvey'`, you can do:

```js
pouch.query(viewName, {startkey: ['Harvey'], endkey: ['Harvey', {}]});
```

In [CouchDB collation ordering][couchdb-collation], `{}` is higher than everything except other objects.


For the database geeks: implementation details
-------

If you want to know how map/reduce works in PouchDB, it's actually exceedingly easy: just open up your browser's developer tools, head over to "Resources," and see where we've created a bonus database to store the index.

One of the neat things about how we implemented map/reduce is that we managed to do it entirely within PouchDB itself.  Yep, that's right: your map/reduce view is just a regular old PouchDB database, and map/reduce itself is a plugin with no special privileges, creating databases in exactly the same way a regular user would.  Since the implementation sits on top of the PouchDB API, it's exactly the same for all three backends: LevelDB, IndexedDB, and WebSQL.

How did we pull off this trick?  To be clear: it's not like we set out to make PouchDB some kind of map/reduce engine.  In fact, as we were debating how to implement this feature, we originally ran on the assumption that we'd need to build additional functionality on top of PouchDB. It was only after a few months of discussions and experiments that we realized the whole thing could be done in PouchDB proper.

In the end, the only additional functionality we had to add to the main PouchDB code was a hook to tell PouchDB to destroy the map/reduce database when its parent database was destroyed.  That's it.

This technique also has a nice parallel in CouchDB: it turns out that they, too, reused the core `_view` code in order to write `_all_docs`.  In CouchDB, `_all_Docs` is just a special kind of `_view`, whereas in PouchDB, we built map/reduce views on top of `allDocs()`.  We did it backwards, but the spirit of the idea was the same.

As for the index itself, what it basically boils down to is clever serialization of arbitrary JSON values into [CouchDB collation ordering][couchdb-collation] &ndash; i.e. nulls before booleans, booleans before numbers, numbers before strings, strings before arrays, arrays before objects, and so on recursively.  Every JSON object maps to an indexable string that guarantees the same ordering in every database backend, and we only deviate from CouchDB by using ASCII string ordering instead of ICU ordering (since that's what our backends use).

  [couchdb-collation]: http://couchdb.readthedocs.org/en/latest/couchapp/views/collation.html

Then, we take this value and concatenate it with whatever else needs to be indexed (usually just the doc `_id`), meaning the entire lookup key is a single string.  We decided on this implementation because:

1. LevelDB does not support complex indexes.
2. IndexedDB _does_ support complex indexes, but [not in IE][ie-complex-keys].
3. WebSQL supports multi-field indexes, but it's also a dead spec, so we're not going to prioritize it above the others.

The next part of the design was to divide the data we needed to store into two kinds of documents: 1) emitted key/values with doc IDs, which are used for querying and pagination, and 2) mappings from doc IDs to those key/values, so that we can delete or update them when their parent documents are deleted or updated. Since by design, PouchDB databases do not have multi-document transaction semantics, we implemented a task queue on top of the database to serialize writes.

Aside from that, the only other neat trick was a liberal use of `_local` documents, which are a special class of documents that aren't counted in the `total_rows` count, don't show up in `allDocs`, but can still be accessed using the normal `put()` and `get()` methods.  This is all it takes to fully reimplement CouchDB map/reduce in a tiny JavaScript database!

Anyone interested in more implementation details can read the months-long discussions in [these][mapreduce-12] [Github][1549] [issues][1658].  The [map/reduce code][mapreduce] itself is also pretty succinct.

[mapreduce]: https://github.com/pouchdb/mapreduce
[mapreduce-12]: https://github.com/pouchdb/mapreduce/issues/12
[1549]: https://github.com/pouchdb/pouchdb/issues/1549
[1658]: https://github.com/pouchdb/pouchdb/issues/1658
[ie-complex-keys]: https://gist.github.com/nolanlawson/8330172
