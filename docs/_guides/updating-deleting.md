---
index: 7
layout: guide
nav: Updating/deleting documents
title: Updating and deleting documents
sidebar: guides_nav.html
---

As we saw in the past two chapters, working with PouchDB documents can be tricky, because you have to manage the revision identifier `_rev`.

Now that we understand promises, though, there are few techniques we can use to make our code more elegant and readable.

Creating a default document
------

Often in our code, we'll want to `get()` a document, and if it doesn't exist, we want to create some default.

For instance, let's say we have a configuration object. We want to provide some reasonable defaults for our config:

```js
{
  _id: 'config',
  background: 'blue',
  foreground: 'white',
  sparkly: 'false'
}
```

This is a pretty good default setting! So let's write the code to set it as our default.

Thankfully, promises make this rather easy:

```js
db.get('config').catch(function (err) {
  if (err.status === 404) { // not found!
    return {
      _id: 'config',
      background: 'blue',
      foreground: 'white',
      sparkly: 'false'
    };
  } else { // hm, some other error
  	throw err;
  }
}).then(function (configDoc) {
  // sweet, here is our configDoc
}).catch(function (err) {
  // handle any errors
});
```

This code is doing the following:

* Try to `get()` a doc with `_id` equal to `'config'`
* If it doesn't find it, return the default doc
* Otherwise, you'll just get back the existing document

You can see **[a live example](http://bl.ocks.org/nolanlawson/0a01d466b2d331cf7e25)** of this code.

Why must we dance this dance?
--------

A common question from new PouchDB/CouchDB users is: why do we have to deal with `_rev` at all? Why can't I just `put()` the document without providing a `_rev`?

The answer is: because `_rev`s are what makes sync work so well. PouchDB asks for a little upfront effort with managing document revisions, so that later on, sync is a breeze.

In fact, you are probably already familiar with a system that forces you to go through a similar dance. This system is called [Git](http://www.git-scm.com/).

PouchDB and CouchDB's document revision structure is very similar to Git's. In fact, each document's revision history is stored as a tree (exactly like Git), which allows you to handle conflicts when any two databases get out of sync.

```
rev 3-a  rev 3-b
      \___/
        |    
      rev 2
        |
      rev 1
```

Conflicts will be discussed later in this guide. For now, you can think of revisions as being a single lineage:

```  
      rev 4
        |
      rev 3
        |    
      rev 2
        |
      rev 1
```

Deleting documents
-------

When you `remove()` a document, it's not really deleted; it just gets a `_deleted` attribute added to it.

That is, the database saves a tombstone at the end of the revision tree.

```  
{_id: 'foo', _rev: '4-z', _deleted: true}
            |
{_id: 'foo', _rev: '3-y'}
            |    
{_id: 'foo', _rev: '2-x'}
            |
{_id: 'foo', _rev: '1-w'}
```

There are three ways of deleting a document, which are all equivalent:

1) You can call `db.remove(doc)`:

```js
db.get('mydoc').then(function (doc) {
  return db.remove(doc);
});
```

2) You can call `db.remove(doc._id, doc._rev)`:

```js
db.get('mydoc').then(function (doc) {
  return db.remove(doc._id, doc._rev);
});
```

3) You can call `db.put(doc)` with `_deleted` set to `true`:

```js
db.get('mydoc').then(function (doc) {
  doc._deleted = true;
  return db.put(doc);
});
```

Of course, you will want to add `catch()` to the end of all these, unless you like to live dangerously.

You can see **[a live example](http://bl.ocks.org/nolanlawson/b2049ad69308e92f15bc)** of this code.

Related API documentation
--------

* [get()](/api.html#fetch_document)
* [put()](/api.html#create_document)
* [remove()](/api.html#delete_document)

Next
--------

Now that we understand how to update and delete documents, let's do it in bulk.
