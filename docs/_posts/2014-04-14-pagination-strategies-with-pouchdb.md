---
layout: post

title: Pagination strategies with PouchDB

excerpt: PouchDB, like CouchDB, was designed to store large amounts of data. However, once you're dealing with hundreds, thousands, or even millions of documents in a single database&hellip;

author: Nolan Lawson

---

PouchDB, like CouchDB, was designed to store large amounts of data. However, once you're dealing with hundreds, thousands, or even millions of documents in a single database, proper pagination becomes crucial if you want to offer anything manageable to your users.  Nobody likes scrolling through a mile-high web page to try to find what they want.

## A basic example

Let's pretend we're storing 20 documents in PouchDB:

```javascript
var pouch = new PouchDB('numbers');
var docs = [
  {_id : 'doc01', name : 'uno'},        {_id : 'doc02', name : 'dos'},
  {_id : 'doc03', name : 'tres'},       {_id : 'doc04', name : 'cuatro'},
  {_id : 'doc05', name : 'cinco'},      {_id : 'doc06', name : 'seis'},
  {_id : 'doc07', name : 'siete'},      {_id : 'doc08', name : 'ocho'}, 
  {_id : 'doc09', name : 'nueve'},      {_id : 'doc10', name : 'diez'},  
  {_id : 'doc11', name : 'once'},       {_id : 'doc12', name : 'doce'},
  {_id : 'doc13', name : 'trece'},      {_id : 'doc14', name : 'catorce'},
  {_id : 'doc15', name : 'quince'},     {_id : 'doc16', name : 'dieciseis'},
  {_id : 'doc17', name : 'diecisiete'}, {_id : 'doc18', name : 'dieciocho'},
  {_id : 'doc19', name : 'diecinueve'}, {_id : 'doc20', name : 'veinte'},
];
pouch.bulkDocs({docs : docs}, function (err, response) {
  // handle err or response
});
```

Now, the simplest kind of Pouch query, called [`allDocs()`](http://pouchdb.com/api.html#batch_fetch), doesn't do any pagination by default.  As the name implies, it just returns all the docs:

```javascript
pouch.allDocs(function (err, response) {
  // handle err or response
});
```

Here's the response:

```javascript
{
  "total_rows": 20,
  "offset": 0,
  "rows": [
    {
      "id": "doc01",
      "key": "doc01",
      "value": { "rev": "1-8e483b9e178a8e58e3f1a4690b3d6e9a"}
    },
    {
      "id": "doc02",
      "key": "doc02",
      "value": {"rev": "1-f6fee051188e84ac3d22c645c819a5d2"}
    },
    /* etc. */
    {
      "id": "doc20",
      "key": "doc20",
      "value": {"rev": "1-f6fee051188e84ac3d22c645c819a5d2"}
    }
  ]
}
```

{% include alert_start.html variant="warning"%}

<strong>Potential gotcha!</strong> Somewhat unintuitively, <code>allDocs()</code> doesn't return the full document data by default.  It only returns the document <code>id</code> and revision hash <code>rev</code>, unless you pass in the option <code>{include_docs : true}</code>.

{% include alert_end.html %}

All 20 documents are returned, no pagination involved.  We can visualize it graphically like this:

```
First doc returned                                    Last doc returned
 ↓                                                                   ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

Now obviously, returning all 20 docs is nice, but we're here to paginate!  So let's see what we can pass to the `allDocs()` method to slice and dice our data.

## Learning the pagination lingo

`allDocs()` is a pretty flexible API, and we have a lot of parameters to choose from.  Since PouchDB is modeled after CouchDB, we can learn about these parameters by directly consulting [the Couch docs][couch-query-api], but here's a basic rundown:

* `startkey`: the `_id` of the first doc we'd like to fetch
* `endkey`: the `_id` of the last doc we'd like to fetch
* `limit`: maximum number of docs to return
* `skip`: number of docs to skip
* `descending`: `true` if we want reverse ordering

These parameters are simply passed as the first argument to `allDocs()`, e.g.

```javascript
pouch.allDocs({startkey : 'doc05', endkey : 'doc06'}, function (err, response) {
  // handle err or response
});
```

Here's the response:

```javascript
{
  "total_rows": 20,
  "offset": 0,
  "rows": [
    {
      "id": "doc05",
      "key": "doc05",
      "value": {"rev": "1-15397f81e784ee1a05d3ab6da07afe8d"}
    },
    {
      "id": "doc06",
      "key": "doc06",
      "value": {"rev": "1-5b35abcf7cc48e2cea63e64281f271ca"}
    }
  ]
}
```

Now, let's go through each of these parameters in detail.

### startkey and endkey

`startkey` simply tells PouchDB where you'd like to start in the stream.  For instance, the options `{startkey : 'doc5'}` would return these docs:

```
      First doc returned                              Last doc returned
             ↓                                                       ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

Similarly, `endkey` tells PouchDB where to stop reading.  `{endkey : 'doc15'}` would give us:

```
First doc returned                         Last doc returned
 ↓                                               ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

These two options can be used together!  `{startkey : 'doc5', endkey: 'doc15'}` gives us:

```
      First doc returned                   Last doc returned
             ↓                                   ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

Notice that both `startkey` and `endkey` are *inclusive* &mdash; i.e., the matching value itself is included in the results.

However, the value doesn't actually need to be present. So for example, if you have the documents ```['A', 'B', 'X', 'Y']```, calling `{startkey : 'C', endkey : 'Z'}` would return `['X', 'Y']`.

### skip and limit

`skip` tells PouchDB how many documents to skip from its normal starting point.  E.g. `{skip : 5}` gives us:

```
      First doc returned                              Last doc returned
             ↓                                                       ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

Whereas `limit` does the opposite: it cuts off documents from the end. `{limit : 15}` only gives us the first 15 docs:

```
First doc returned                         Last doc returned
 ↓                                               ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

When `skip` and `limit` are used together, `limit` applies after `skip`.  So e.g. `{skip : 5, limit : 10}` would slice your documents like this:

```
         First doc returned                Last doc returned
                ↓                                ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```


### Skipping into a trap

If you come from a SQL background, you might recognize `skip` and `limit` as our old friends from SQL: `OFFSET` and `LIMIT`. You might also imagine that these parameters are the only ones you need for proper pagination.  But this is a trap!

#### Dumb method (do not use!)

```javascript
var pageSize = 5;
var offset = 0;
function fetchNextPage() {
  pouch.allDocs({limit : pageSize, skip : offset}, function (err, response) {
    offset += pageSize;
    // handle err or response
  });
}
```

This method is intuitive, but once `skip` grows to a large number, your performance will start to degrade pretty drastically.  That's because those documents must literally be *skipped* over with each query, and the database will still read into memory every document that it's skipping. This can be really bad for performance, especially on mobile devices with constrained memory.

Just repeat to yourself: `skip` really means "skip"!

#### Smart method (please use!)

```javascript
var options = {limit : 5};
function fetchNextPage() {
  pouch.allDocs(options, function (err, response) {
    if (response && response.rows.length > 0) {
      options.startkey = response.rows[response.rows.length - 1];
      options.skip = 1;
    }
    // handle err or response
  });
}
```

This method takes a bit more time to grok, but what it's essentially doing is leveraging `startkey`, instead of relying on the performance-killer `skip`.

In our initial query, we simply tell PouchDB to give us the first 5 documents (or 10, or whatever your page size is).  In our subsequent queries, we tell it to start with the last doc from the previous page, and to `skip` that one doc.

Of course, you could also fetch `pageSize + 1` docs each time, and simply omit the last document when you display the results to the user.  The choice is yours, but either method is preferable to using `skip` and `limit` alone.

{% include alert_start.html  variant="info"%}

<strong>Aside</strong>: To be fair, WebSQL and CouchDB (since <a href='https://issues.apache
.org/jira/browse/COUCHDB-977'>version 1.1.1</a>) do not
suffer from this problem, due to their ability to efficiently count SQLite rows/B-tree offsets.
However, since IndexedDB and LevelDB (and other backends modeled on <a href='https://github
.com/rvagg/node-leveldown/'>LevelDOWN</a>) are
traditional key-value stores, they don't have a good way to count offsets.  Also, some <a href='http://danielwertheim.se/2014/04/01/couchdb-pagination-is-skip-and-limit-enough/
'>experimental data</a> suggests that CouchDB 1.5 is still faster with the <code>startkey</code> pattern. So you're better off just using <code>startkey</code> everywhere.

{% include alert_end.html %}

## Paginating in backwards land

When `descending` is set to `true`, the normal document order is reversed.  Simply passing `{descending : true}` would give us:

```
First doc returned                                    Last doc returned
 ↓                                                                   ↓ 
[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
```

Additionally, all the other parameters suddenly work backwards from their normal behavior!  For instance, if we want to fetch the documents from `'doc01'` to `'doc10'`, we'd normally do:

```javascript
pouch.allDocs({startkey : 'doc01', endkey : 'doc10'}, function (err, response) {
  // handle err or response
});
```

This would give us 10 results, as expected:

```
First doc returned     Last doc returned
 ↓                           ↓ 
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
```

If we set `descending` to `true`, though, we're in backwards land! So that same query will give us zero results:

```
                                       Last doc???         First doc???
                                          ↓                          ↓ 
[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
```

Here's the actual JavaScript `response` object:

```javascript
{
  "total_rows": 20,
  "offset": 0,
  "rows": []
}
```

Whenever `descending` is set to `true`, we need to switch the `startkey` and `endkey` to get the results we want:

```javascript
pouch.allDocs({startkey : 'doc10', endkey : 'doc01', descending : true}, function (err, response) {
  // handle err or response
});
```

This gives us what we expect:

```
                               First doc returned     Last doc returned
                                          ↓                          ↓ 
[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
```

### Skip and limit in backwards land

Similarly, for `skip` and `limit`, the operations are performed on the reversed list.  Setting `skip` to `5` will skip the "first" 5 documents, so `{skip : 5, descending : true}` returns:

```
               First doc returned                     Last doc returned
                      ↓                                              ↓ 
[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
```

And setting `limit` to `15` will give us the "first" 15 documents, so `{limit : 15, descending : true}` gives us:

```
First doc returned                              Last doc returned
  ↓                                                   ↓ 
[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
```

Of course, you're free to go nuts and combine these parameters together. For example, the somewhat bloated options:

```javascript
{
  skip : 1,
  limit : 5,
  startkey : 'doc10',
  descending : true
}
```

would give us:


```
                             First doc returned    Last doc returned
                                             ↓           ↓ 
[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
```

## Keeping your strings in order

In the examples up to now, I've been careful to name my documents `'doc01'`, `'doc02'`, etc.  Astute readers might wonder if that's because PouchDB uses standard [JavaScript string ordering][js-string-ordering].  And those smarty-pants readers would be correct!  Since `doc2` comes after `doc10` in lexicographical ASCII order, I pad the single digits with zeroes.

This can be a very useful trick for document sorting.  Normally, PouchDB will generate a random doc ID if you don't specify one (e.g. `'36483B8A-DF4A-4AEB-B946-096BA0FA8813'`), but if you provide your own IDs, you can make sorting incredibly easy for a variety of applications.

### Example: sort by date

Let's imagine we want to sort our documents by date. For the doc IDs, we'll use timestamps in [standard ISO-8601 format][iso8601], given by `new Date().toJSON()`. This guarantees proper lexicographical ordering:

  [iso8601]: http://www.w3.org/TR/NOTE-datetime

```javascript
var partyLikeIts = new Date(915148800000); // 1999
var now = new Date(1394841840000);         // 2014

partyLikeIts.toJSON() // "1999-01-01T00:00:00.000Z"
now.toJSON()          // "2014-03-15T00:04:00.000Z"

// Party on!
partyLikeIts.toJSON() < now.toJSON(); // true
```

{% include alert_start.html variant="warning" %}

<strong>Note:</strong> If you're worried about ID collisions, you could also use <code>new Date().toJSON() + Math.random()</code>.

{% include alert_end.html %}

Now we can fetch the 10 most recent docs:

```javascript
{
  limit : 10,
  descending : true
}
```

Or the first 10 docs published after January 1st, 2000:

```javascript
{
  limit : 10,
  startkey : '2000-01-01T00:00:00.000Z'
}
```


And if you need fancier sorting, or more than one index, try the Map/Reduce-powered [`query()` API][query-api], which boasts [complex key collation](http://docs.couchdb.org/en/latest/couchapp/views/collation.html#collation-specification).

## total_rows is totally awesome

When we call `allDocs()`, a typical response object looks like this:

```javascript
{
  "total_rows": 20,
  "offset": 0,
  "rows": [/* results go here */]
}
```

`offset` simply tells us how many documents were `skip`ped, but `total_rows` tells us the total number of docs in our database.  This can be very useful if you want to calculate how many documents are left to be read in, or if you just want to quickly fetch the database size.

For instance, calling `allDocs()` with `{limit : 0}` will simply return an empty list:

```javascript
{
  "total_rows": 20,
  "offset": 0,
  "rows": []
}
```

If you're a SQL jockey, you can think of this as your `COUNT(*)`.


## Putting it all together

PouchDB and CouchDB handle pagination like it ain't no thing.  There are more advanced topics, like how to page through Map/Reduce views with the `query()` API, but if you understand `allDocs()`, you're already 75% of the way there.

So congratulations, you're now a [Page Master]!  Try to use your newfound powers for good.

  [couch-query-api]: https://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
  [js-string-ordering]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#Comparing_strings
  [collation-specification]: http://docs.couchdb.org/en/latest/couchapp/views/collation.html#collation-specification
  [query-api]: http://pouchdb.com/api.html#query_database
  [page master]: https://en.wikipedia.org/wiki/Pagemaster
  [remove]: http://pouchdb.com/api.html#delete_document