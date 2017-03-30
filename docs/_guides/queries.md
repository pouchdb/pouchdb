---
index: 14
layout: guide
title: Map/reduce queries
sidebar: guides_nav.html
---

Map/reduce queries, also known as the `query()` API, are one of the most powerful features in PouchDB. However, they can be quite tricky to use, and so this guide is designed to dispell some of the mysteries around them.

The first thing to understand is that you don't need map/reduce queries if you merely want to look up documents by `_id` or sort them by `_id`. The `allDocs()` API already does this, using an efficient built-in index (see ["bulk operations"](bulk-operations.html) for details).

The second thing to know is that map/reduce is also unnecessary if you want to sort documents by their update time &ndash; this is exactly what the [changes feed](changes.html) does! Again, this is a built-in index that you get for free.

Finally, it's important to understand that [Mango queries](mango-queries.html) are much easier to use than map/reduce queries, and they can usually satisfy 99% of use cases. The point of map/reduce is to provide an _extremely advanced_ API for building secondary indexes, suitable for those with specific querying needs.
 
So now that you've read the fine print, let's talk about how map/reduce queries actually work!

{% include anchor.html title="Mappin' and reducin'" hash="mappin-and-reducin" %}

The PouchDB `query()` API (which corresponds to the `_view` API in CouchDB) has two modes: temporary queries and persistent queries.

### Temporary queries

**Temporary queries** are very slow, and we only recommend them for quick debugging during development. To use a temporary query, you simply pass in a `map` function:

```js
db.query(function (doc, emit) {
  emit(doc.name);
}, {key: 'foo'}).then(function (result) {
  // found docs with name === 'foo'
}).catch(function (err) {
  // handle any errors
});
```

In the above example, the `result` object will contain stubs of documents where the `name` attribute is equal to `'foo'`. To include the document in each row of results, use the `include_docs` option.

{% include alert/start.html variant="info" %}

The <code>emit</code> pattern is part of the standard <a href='http://couchdb.readthedocs.org/en/latest/couchapp/views/intro.html'>CouchDB map/reduce API</a>.  What the function basically says is, "for each document, emit <code>doc.name</code> as a key."

{% include alert/end.html %}

### Persistent queries

**Persistent queries** are much faster, and are the intended way to use the `query()` API in your production apps. To use persistent queries, there are two steps.

First, you create a **design document**, which describes the `map` function you would like to use:

```js
// document that tells PouchDB/CouchDB
// to build up an index on doc.name
var ddoc = {
  _id: '_design/my_index',
  views: {
    by_name: {
      map: function (doc) { emit(doc.name); }.toString()
    }
  }
};
// save it
pouch.put(ddoc).then(function () {
  // success!
}).catch(function (err) {
  // some error (maybe a 409, because it already exists?)
});
```

{% include alert/start.html variant="info" %}

The <code>.toString()</code> at the end of the map function is necessary to prep the
object for becoming valid JSON.

{% include alert/end.html %}

{% include alert/start.html variant="info" %}

The <code>emit</code> function will be available in scope when the map function is
run, so don't pass it in as a parameter.

{% include alert/end.html %}

Then you actually query it, by using the name you gave the design document when you saved it:

```js
db.query('my_index/by_name').then(function (res) {
  // got the query results
}).catch(function (err) {
  // some error
});
```

Note that, the first time you query, it will be quite slow because the index isn't
built until you query it. To get around this, you can do an empty query to kick
off a new build:

```js
db.query('my_index/by_name', {
  limit: 0 // don't return any results
}).then(function (res) {
  // index was built!
}).catch(function (err) {
  // some error
});
```

After this, your queries will be much faster.

{% include alert/start.html variant="info"%}

CouchDB builds indexes in exactly the same way as PouchDB. So you may want to familiarize yourself with the <a href='/api.html#query_database'>"stale" option</a> in order to get the best possible performance for your app.

{% include alert/end.html %}


{% include anchor.html title="More about map/reduce" hash="more-about-map-reduce" %}

That was a fairly whirlwind tour of the `query()` API, so let's get into more detail about how to write your map/reduce functions.

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
      emit(doc.name);
    }
  }
}
```

Then you can query it:

```js
// find pokemon with name === 'Pika pi!'
pouch.query(myMapFunction, {
  key          : 'Pika pi!',
  include_docs : true
}).then(function (result) {
  // handle result
}).catch(function (err) {
  // handle errors
});

// find the first 5 pokemon whose name starts with 'P'
pouch.query(myMapFunction, {
  startkey     : 'P',
  endkey       : 'P\uffff',
  limit        : 5,
  include_docs : true
}).then(function (result) {
  // handle result
}).catch(function (err) {
  // handle errors
});
```

{% include alert/start.html variant="info"%}

The pagination options for <code>query()</code> &ndash; i.e., <code>startkey</code>/<code>endkey</code>/<code>key</code>/<code>keys</code>/<code>skip</code>/<code>limit</code>/<code>descending</code> &ndash; are exactly the same as with <code>allDocs()</code>. For a guide to pagination, read the <a href="/guides/bulk-operations.html">Bulk operations guide</a> or <a href='http://pouchdb.com/2014/04/14/pagination-strategies-with-pouchdb.html'>Pagination strategies with PouchDB</a>.

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
}).catch(function (err) {
  // handle errors
});
```

If you're adventurous, though, you should check out the [CouchDB documentation](http://couchdb.readthedocs.org/en/latest/couchapp/views/intro.html) or the [PouchDB documentation](http://pouchdb.com/api.html#query_database) for details on reduce functions.

{% include anchor.html title="Avoiding map/reduce" hash="avoiding-map-reduce" %}

The map/reduce API is complex, and it can be computationally expensive because it requires building up an entirely new index. Therefore, it's good to know some tricks for avoiding the map/reduce API when you don't need it:

1. If you can use `allDocs()` or `changes()` instead of the `query()` API, do it!
2. If your query is simple enough that you can use `find()`, use that instead.
3. Read the [12 tips for better code with PouchDB](/2014/06/17/12-pro-tips-for-better-code-with-pouchdb.html), especially the tip to "use and abuse your doc <code>_id</code>s."
4. If your data is highly relational, try the [relational-pouch](https://github.com/nolanlawson/relational-pouch) plugin, which follows this advice, and only uses `_id` and `allDocs()` under the hood.

{% include anchor.html title="Related API documentation" hash="related-api-documentation" %}

* [query()](/api.html#query_database)
* [viewCleanup()](/api.html#view_cleanup)

{% include anchor.html title="Next" hash="next" %}

Now that we've learned how to map reduce, map reuse, and map recycle, let's move on to `destroy()` and `compact()`.
