---
index: 13
layout: guide
title: Mango queries
sidebar: guides_nav.html
---

Mango queries, also known as `pouchdb-find` or the `find()` API, are a structured query API that allows you to build _secondary indexes_ beyond the built-in `allDocs()` and `changes()` indexes.

This API is useful for answering questions like:

- find all documents where the `type` is `'user'`
- find all users whose `age` is greater than `21`
- find all Pokémon whose `name` starts with `'pika'`
- etc.

{% include anchor.html title="Installation" hash="installation" %}

The `find()` API is currently offered as a separate plugin, meaning that you must install it on top of `pouchdb.js`. Here's how to do so:

### Script tags

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.find.js"></script>
```

The `pouchdb.find.js` file is available in the `pouchdb` package in npm/Bower, on [unpkg](https://unpkg.com/pouchdb/dist/), or [as a GitHub download](https://github.com/pouchdb/pouchdb/releases/download/{{ site.version }}/pouchdb.find.js). Note it must be placed after `pouchdb.js`.

### npm

If you are using Node, Browserify, Webpack, Rollup, etc., then you can install it like so:

    npm install --save pouchdb-find

Then in code:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
```

{% include anchor.html title="Query language" hash="query-language" %}

The [Mango query language](https://github.com/cloudant/mango) is a DSL inspired by MongoDB, which allows you to define an index that is then used for querying. One quick way to understand how this works is to use the [live query demo](https://nolanlawson.github.io/pouchdb-find/).

At a basic level, there are two steps to running a query: `createIndex()` (to define which fields to index) and `find()` (to query the index).

For instance, let's imagine a simple index to look up all documents whose `name` is `"mario"`. First we'll create it:

```js
db.createIndex({
  index: {fields: ['name']}
});
```

This returns a Promise once the index is created. At this point, we have an index based on the `"name"` field, so we can use it for lookup:

```js
db.find({
  selector: {
    name: 'mario'
  }
});
```

This returns a Promise containing an array of all documents that match this selector. Note that this is equivalent to using the `$eq` (equals) operator:

```js
db.find({
  selector: {
    name: {$eq: 'mario'}
  }
});
```

The important thing to understand is that, for a typical database, `createIndex()` is the expensive operation, because it is looping through all documents in the database and building a [B-tree](https://en.wikipedia.org/wiki/B-tree) based on the `name` value.

Once the B-tree is built up, though, the `find()` is relatively cheap. (If this were _not_ the case, then we would be better off just using `allDocs()` to iterate through the database ourselves!)

Once we have an index on `name`, we can also sort all documents by `name`:

```js
db.find({
  selector: {
    name: {$gte: null}
  },
  sort: ['name']
});
```

Note that we are specifying that the `name` must be greater than or equal to `null`, which is a workaround for the fact that the Mango query language requires us to have a selector. In [CouchDB collation order](http://docs.couchdb.org/en/2.1.1/ddocs/views/collation.html), `null` is the "lowest" value, and so this will return all documents regardless of their `name` value.

{% include anchor.html title="Pagination" hash="pagination" %}

Reading all documents in the database and sorting them by a particular value is neat, but we could do this ourselves with `allDocs()`, and it would have the same performance impact. Where it gets more interesting is when we use `limit`:

```js
db.find({
  selector: {
    name: {$gte: null}
  },
  sort: ['name'],
  limit: 10
});
```

In this case, we only get 10 documents back, but they are the first 10 documents, sorted by name. This means that we have only read 10 documents out of the database into memory, which can be used for [efficient pagination](http://pouchdb.com/2014/04/14/pagination-strategies-with-pouchdb.html).

For instance, if we are displaying the first 10 results on a single page, and the user clicks "next" to see the next page, we can restructure our query based on the last result, to continue the pagination. Let's imagine the first 10 documents' `name`s are:

```js
[
  'abby', 'bertrand', 'clarice', 'don', 'emily',
  'fumiko', 'gunther', 'horatio', 'ike', 'joy'
]
```

For our next 10 pages of results, the query becomes:

```js
db.find({
  selector: {
    name: {$gt: 'joy'}
  },
  sort: ['name'],
  limit: 10
});
```

Because we are now specifying that the `name` must be greater than `'joy'`, we are guaranteed to get the next-highest result after `'joy'`, which may (for instance) look like this:

```js
[
  'kim', 'lin', 'maria', 'nell', 'oliver',
  'pat', 'quincy', 'roy', 'sam', 'tanya'
]
```

In this way, we can continue paginating by using the last value as our next starting point. At any given point in time, there are only 10 documents stored in memory at once, which is great for performance.

{% include anchor.html title="Indexing on more than one field" hash="more-than-one-field" %}

Sometimes an index is not as simple as "find all documents whose `name` is `"mario"`. Sometimes you want to do something fancy, such as "find all documents whose `name` is `"mario"` and whose `age` is greater than `21`". In those cases, you can index on more than one field:

```js
db.createIndex({
  index: {
    fields: ['name', 'age']
  }
}).then(function () {
  return db.find({
    selector: {
      name: 'mario',
      age: {$gt: 21}
    }
  });
});
```

One thing to note is that the order of these fields matters when creating your index. For instance, the following would _not_ work:

```js
/* THIS WON'T WORK! */
db.createIndex({
  index: {
    fields: ['age', 'name']
  }
}).then(function () {
  return db.find({
    selector: {
      name: 'mario',
      age: {$gt: 21}
    }
  });
});
```

The reason for this is easy to understand if we imagine how this index would sort a hypothetical database:

<div class="table-responsive">
<table class="table">
<tr>
  <th>name</th>
  <th>age</th>
</tr>
<tr>
  <td>Luigi</td>
  <td>17</td>
</tr>
<tr>
  <td>Luigi</td>
  <td>28</td>
</tr>
<tr>
  <td>Mario</td>
  <td>18</td>
</tr>
<tr>
  <td>Mario</td>
  <td>21</td>
</tr>
<tr>
  <td>Mario</td>
  <td>22</td>
</tr>
<tr>
  <td>Mario</td>
  <td>26</td>
</tr>
<tr>
  <td>Peach</td>
  <td>17</td>
</tr>
<tr>
  <td>Peach</td>
  <td>21</td>
</tr>
<tr>
  <td>Peach</td>
  <td>25</td>
</tr>
</table>
</div>

In the above table, the documents are sorted by `['name', 'age']`, and our "Marios above the age of 21" are very clearly grouped together.

However, if we were to change the order, and sort them by `['age', 'name']`, it would look instead like this:

<div class="table-responsive">
<table class="table">
<tr>
  <th>age</th>
  <th>name</th>
</tr>
<tr>
  <td>17</td>
  <td>Luigi</td>
</tr>
<tr>
  <td>17</td>
  <td>Peach</td>
</tr>
<tr>
  <td>18</td>
  <td>Mario</td>
</tr>
<tr>
  <td>21</td>
  <td>Mario</td>
</tr>
<tr>
  <td>21</td>
  <td>Peach</td>
</tr>
<tr>
  <td>22</td>
  <td>Mario</td>
</tr>
<tr>
  <td>25</td>
  <td>Peach</td>
</tr>
<tr>
  <td>26</td>
  <td>Mario</td>
</tr>
<tr>
  <td>28</td>
  <td>Luigi</td>
</tr>
</table>
</div>

If we imagine our `find()` query as a "slice" of the data, it's obvious that there's no slice that corresponds to "all Marios whose age is greater than 21." Instead, our documents are sorted by `age`, and then documents with the same `age` are sorted by `name`.

This index may be good for answering questions like "find all 17-year-olds whose name starts with letters N-Z", but it's not very good for answering questions like "find all people with a certain name, older than a certain age."

This shows that it's important to carefully design an index before creating a query to use that index. Otherwise, the query planner may fall back to in-memory querying, which can be expensive.

{% include anchor.html title="Performance notes" hash="performance-notes" %}

The Mango query language is generally very permissive, and allows you to write queries that may not perform very well, but will run regardless. For instance, you may create an index with `createIndex()`, but then write a `find()` query that doesn't actually use that index. In general, the query planner tries to find the most appropriate index, but it may fall back to in-memory querying.

As a straightforward example, if you query using the `_id` field, then the query planner will automatically map that directly to an `allDocs()` query. However, if you query for a field that isn't yet indexed, then it will simply use `allDocs()` to read in all documents from the database (!) and then filter in-memory. This can lead to poor performance, especially if your database is large.

If you're ever wondering how the query planner is interpreting your query, you can use the explain endpoint:

```js
db.explain({
  selector: {
    name: 'mario',
    age: {$gt: 21}
  }
})
.then(function (explained) {
  // detailed explained info can be viewed
});

```

Or you enable debugging like so:

```js
PouchDB.debug.enable('pouchdb:find');
```


In the console, the query planner will show a detailed explanation of how it has interpreted the query, whether it uses any indexes, and whether any parts of the query need to be executed in-memory.


You may also want to pay attention to the `"warning"` value included in your results set, indicating that there was no index that matched the given query. For instance, the warning may look like this:

```js
{
  "docs": [ /* ... */ ],
  "warning": "no matching index found, create an index to optimize query time"
}
```

{% include anchor.html title="Set which index to use" hash="use_index" %}

When creating a query, by settings the `use_index` field, it is possible to tell pouchdb-find which index to use.
The below example shows how to do that.

```js
db.createIndex({
  index: {
    fields: ['age', 'name'],
    ddoc: "my-index-design-doc"
  }
}).then(function () {
  return db.find({
    selector: {
      name: 'mario',
      age: {$gt: 21},
    },
    use_index: 'my-index-design-doc'
  });
});
```

{% include anchor.html title="Further reading" hash="further-reading" %}

The Mango query language is quite large and supports many options. Some of the more common ones include:

* `$eq`: equals
* `$gt`: greater than
* `$gte`: greater than or equal to
* `$lt`: less than
* `$lte`: less than or equal to

There are many more options besides these, although note that not all of them can take advantage of indexes. For instance, `$regex`, `$ne`, and `$not` cannot use on-disk indexes, and must use in-memory filtering instead.

The most complete documentation for selector options can be found in the [CouchDB `_find` documentation](http://docs.couchdb.org/en/2.0.0/api/database/find.html). You might also look at the [Cloudant Query Language](https://docs.cloudant.com/cloudant_query.html) documentation (which is nearly identical to Mango, other than `text` and other Cloudant-specific features). PouchDB uses CouchDB as the reference implementation; they ought to be functionally identical.

It should be noted that, over HTTP, this API currently works with CouchDB 2.0+, Cloudant, and PouchDB Server.
CouchDB 2.0 is the reference implementation, so the API should be the same. CouchDB 1.6.1 and below is not supported.

{% include anchor.html title="Related API documentation" hash="related-api-documentation" %}

* [createIndex()](/api.html#create_index)
* [find()](/api.html#query_index)
* [getIndexes()](/api.html#list_indexes)
* [deleteIndex()](/api.html#delete_index)

{% include anchor.html title="Next" hash="next" %}

Now that we've learned how to do structured Mango queries, let's try some more advanced queries, using _map/reduce_.
