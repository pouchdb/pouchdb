---
layout: learn
title: Plugins - PouchDB
---

# PouchDB Plugins

Writing a plugin is easy! The api is:

{% highlight js %}
PouchDB.plugin({
  methodName: myFunction
  }
});
{% endhighlight %}

This will add the function as a method of all databases with the given method name.  It will always be called in context, so that `this` always refers to the database object.

#### Example Usage:
{% highlight js %}
PouchDB.plugin({
  sayMyName : function () {
    this.info().then(function (info)   {
      console.log('My name is ' + info.db_name);
    }).catch(function (err) { });
  }
});
new PouchDB('foobar').sayMyName(); // prints "My name is foobar"
{% endhighlight %}

#### Index data

Plugins also have access to a special `db.index()` API that gives developers the ability to store plugin-specific metadata in a database. This API has two main features:

1. The stored data is unique per database
2. It doesn't collide with user data.
3. It supports pagination as well as a secondary index.

##### Putting data

Example:

{% highlight js %}
PouchDB.plugin({
  myPluginFunction : function () {
    this.index().put('groupId', {
      'key1' : 'value1',
      'key2' : 'value2',
      'key3' : {
        'fancy' : 'data',
        'so' : 'the value can be anything!'
      }
    }, function (err) {});
  }
});
{% endhighlight %}

The `groupId` and `key`s must be strings, but the values can be any valid JavaScript object.

This is an all-or-nothing operation, so if you add new data to `groupId`, any data previously
associated with `groupId` will be overwritten.  You may `put` an empty object or `null` to delete all associated data.

##### Getting data

Getting data from the index is as simple as specifying the `key`s from the aforementioned object.

The basic method is to specify a simple string `key`:

{% highlight js %}
PouchDB.plugin({
  myPluginFunction : function () {
    this.index().get('key1', function (err, res) {
    /* handle err or res */
    });
  }
});
{% endhighlight %}

Example response:

{% highlight js %}
{
  "id"    : "groupId",
  "key"   : "key1",
  "value" : "value1"
}
{% endhighlight %}

This method either returns the data itself or an error if not found.

Alternatively, you can specify an options object with the familiar Couch-style `startkey`/`endkey`/`descending`/`skip`, which behave exactly like those parameters when used in `allDocs()` or `query()`:


{% highlight js %}
PouchDB.plugin({
  myPluginFunction : function () {
    this.index().get({
      startkey : 'key1',
      endkey   : 'key2'
    }, function (err, res) {
    /* handle err or res */
    });
  }
});
{% endhighlight %}

Example response:

{% highlight js %}
[
  {
    "id"    : "groupId",
    "key"   : "key1",
    "value" : "value1"
  },
  {
    "id"    : "groupId",
    "key"   : "key2",
    "value" : "value2"
  }
{% endhighlight %}

##### Uses

The most common use case for this API would be for storing document-specific data that requires range queries on the keys emitted by those documents.

For instance, you could implement a search plugin where the `groupId`s are document IDs and the `key`s are terms found in that document.  When a user searches for a term, you page through all documents that match that term using `get()`.  When a document is deleted or updated, you remove or update all the document's associated terms using `put()`.

Keep in mind that plugin data is only stored locally, so it doesn't apply to remote CouchDB databases.  See the [Map/Reduce plugin][mapreduce] for a more full-fledged example of how to use this API.

  [mapreduce]: https://github.com/pouchdb/mapreduce


