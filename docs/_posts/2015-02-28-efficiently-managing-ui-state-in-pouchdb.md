---
layout: post

title: Efficiently managing UI state with PouchDB

author: Nolan Lawson

---

A common pattern in data-driven apps is to display the entire database in the UI. If you're using PouchDB, that means you want to mirror the contents of PouchDB to some in-memory representation used by the UI.

This could apply to any JavaScript framework such as React, Ember, or Angular. But whatever framework we choose, we'd like to use PouchDB in an efficient way, so that the UI does as little work as possible. Let's learn how.

First off, let's say you are sorting all your documents by `_id`. You might have a database:

```js
var db = new PouchDB('my_db');
```

And a function to fetch all the documents (using `allDocs()`) and then render them:

```js
function fetchAndRenderAllDocs() {
  db.allDocs({include_docs: true}).then(function (res) {
    var docs = res.rows.map(function (row) { return row.doc; });  
    renderDocsSomehow(docs);
  }).catch(console.log.bind(console));
}
```

This is okay, but it would be better if the UI could update automatically whenever a document is changed.

A naïve implementation might look like this:

```js
db.changes({live: true, since: 'now'}).on('change', function () {
  fetchAndRenderAllDocs();
}).on('error', console.log.bind(console));

fetchAndRenderAllDocs();
```

This code works, but now we are re-fetching the documents every time a single document changes. This can get pretty slow, especially if you have a lot of documents, because you are constantly re-reading the entire database into memory.

Wouldn't it be better if we could update only the part of the `docs` array that actually changed? Yes, and we can!

The PouchDB changes feed has a `{include_docs: true}` option, which will give us exactly the document that changed. There is also a `deleted` flag that tells us if a document was deleted. So let's react to that:

```js
var docs;

function fetchInitialDocs() {
  return db.allDocs({include_docs: true}).then(function (res) {
    docs = res.rows.map(function (row) { return row.doc; });
    renderDocsSomehow();
  });
}

function reactToChanges() {
  db.changes({live: true, since: 'now', include_docs: true}).on('change', function (change) {
    if (change.deleted) {
      // change.id holds the deleted id
      onDeleted(change.id);
    } else { // updated/inserted
      // change.doc holds the new doc
      onUpdatedOrInserted(change.doc);
    }
    renderDocsSomehow();
  }).on('error', console.log.bind(console));
}

fetchInitialDocs().then(reactToChanges).catch(console.log.bind(console));
```

Now, we need some way to update the array after the changes come in. Our documents are already sorted by `_id`, but we want to keep them sorted.

So, let's write a quick binary search implementation:

```js
function binarySearch(arr, docId) {
  var low = 0, high = arr.length, mid;
  while (low < high) {
    mid = (low + high) >>> 1; // faster version of Math.floor((low + high) / 2)
    arr[mid]._id < docId ? low = mid + 1 : high = mid
  }
  return low;
}
```

Now let's implement the `onDeleted()` function:

```js
function onDeleted(id) {
  var index = binarySearch(docs, id);
  var doc = docs[index];
  if (doc && doc._id === id) {
    docs.splice(index, 1);
  }
}
```

And the `onUpdatedOrInserted()` function:

```js
function onUpdatedOrInserted(newDoc) {
  var index = binarySearch(docs, newDoc._id);
  var doc = docs[index];
  if (doc && doc._id === newDoc._id) { // update
    docs[index] = newDoc;
  } else { // insert
    docs.splice(index, 0, newDoc);
  }
}
```

There you have it! Now the `docs` array will be kept perfectly in sync with PouchDB.

And even if you're not displaying the entire database in memory (which may be unfeasible for large databases), you can still use this pattern. You'll just need to change the way you render your initial state (e.g. using a `query()` instead of `allDocs()`), and to filter the documents in your `on('change')` listener. You can either do it directly in code, or you can have PouchDB do it for you with the `filter`/`view`/`doc_ids` options.

{% include alert/start.html variant="info" %}

There's no performance benefit to using <code>filter</code>/<code>view</code>/<code>doc_ids</code> on a local database. With a remote database, however, you may get a performance boost, because it's not sending so much data over the wire.

{% include alert/end.html %}

Another neat thing about this code is that it elegantly handles conflicts. Since `{include_docs: true}` will only give us the *winning* revision of a document, we are guaranteed that we'll never show conflicting versions of the same document in the array. We can still handle conflicts in [the usual way](http://pouchdb.com/guides/conflicts.html), and the changes feed will simply tell us if the winning revision has changed.

I've written [a toy app](http://bl.ocks.org/nolanlawson/3e096160b848689f1058) to demonstrate this code. Feel free to borrow it for your next super-fast PouchDB-powered app.
