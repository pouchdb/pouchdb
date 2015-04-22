---
layout: post

title: Filtered replication&#58; from Couch to Pouch and back

author: Giovanni Ornaghi

---

Filtered replication can become a vital feature for many applications, when you realize you don't need the whole dataset to be replicated to each client. At the same time, filtered replication can be the wrong solution to your problem if:

* __You're trying to address security concerns.__ Replicating only the user's documents via filtering might seem simplest, but filtering isn't a substitute for proper authentication. 
* __There's no big security concern, but you'd like to provide a better per-user or per-role experience.__ There's no shame in creating a DB per user or DB per role! Nolan Lawson discussed such recipes [here](https://github.com/nolanlawson/pouchdb-authentication#couchdb-authentication-recipe).

So what is filtered replication good for? One use case is apparent: you want to give your users only a certain amount of documents, which may or may not involve their identity or roles. Sometimes these documents need to be shared by multiple users with real-time feedback, which would make the DB-per-user solution impractical. And often, these groups of users are too volatile to effectively implement a DB-per-role solution.

In these situations, the best solution is filtering.

### Filters in PouchDB

In the PouchDB world, there are two shapes of filtered replication:

* __Client-side filtering__ takes nothing more than a JS function. This will prevent useless documents from being stored locally, but it means the documents will still go over the wire, and the client will waste CPU cycles to handle them properly.
* __Server-side filtering__, again, takes nothing more than a JS function, but it's executed by CouchDB. This will prevent documents from going over the wire in the first place! So obviously we prefer this one.

### A simple implementation

{% include alert/start.html variant="warning" %}
To reproduce the examples you’ll need PouchDB v3.4.0, which contains some bugfixes for filtered replication.
{% include alert/end.html %}

The first step in implementing your server-side filtering solution is to create the design document. This is an example:

{% highlight js %}
{
   "_id": "_design/app",
   "filters": {
     "by_agent": function(doc, req) {
       return doc.agent === req.query.agent;
     }.toString()
   }
}
{% endhighlight %}

Filters in CouchDB are like filters as higher-order functions: they take some arguments and return `true` or `false`. Note that the function needs to be stringified when you store it!

{% include alert/start.html variant="info" %}

{% markdown %}

While in these examples I'm using a filter, the rest of this post will hold if you decide to use a view instead.

At this point you might be wondering about the difference between a view and a filter. My reason for using filters is easy: I want to emit the whole document, and I want to emit documents according to a parameter provided by the client. While you could create a view that emits the whole document, taking parameters becomes [a bit too complicated for my taste](http://guide.couchdb.org/editions/1/en/cookbook.html). 

{% endmarkdown %}

{% include alert/end.html %}

We'll come back to this design document later. Now it's time to implement our client-side logic. By reading the awesome [API docs](http://pouchdb.com/api.html#replication), we see that `sync` has various options:

* `filter`: can take either the string corresponding to the filter function (see example below), or a JS function (for client-side filtering).
* `query_params`: takes a JS object. This object is what we find in the `req.query` object inside the design document function. Just what we need!

{% highlight js %}
localDB.sync(remoteDB, {
  live: true,
  retry: true,
  filter: 'app/by_agent',
  query_params: { "agent": agent }
}).on('change', function(result) {
  if (change.deleted){
    // remove
  } else {
    // upsert
  }
});
{% endhighlight %}

We're doing a two-way replication (from Couch to Pouch and back), using a filter (in our faithful design document) all in real-time (see `live` and `retry` options). Couch will give us a batch of documents from the `_changes` feed, which we then iterate and manage according to our needs.

### Caveats

Now, this looks easy, and it is, but there are a few gotchas:

* Since we're doing live replication, the `complete` event will not trigger, so use `paused` instead.
* Documents will come in batches, so you might not get the whole `_changes` feed at once.
* You cannot really delete documents in the local database. Purging is a feature the PouchDB team is [still working on](https://github.com/pouchdb/pouchdb/issues/802).
* If you change something on the server side to cause the document to no longer pass the filter, then the document won't pass the filter. Crazy, right? CouchDB won't check the last two versions of the document &ndash; just the last one. This simply means that those documents will persist on the client and never be present in the `_changes` feed.
* Watch how you delete your documents! Simply going into Futon and happily clicking "Delete Document&hellip;" won't replicate the deletion. What you want to do is update the document, adding a `_deleted: true` field. From the [CouchDB docs](https://wiki.apache.org/couchdb/Replication):

> When using filtered replication, you should not use the `DELETE` method to remove documents, but instead use `PUT` and add a `_deleted:true`
> field to the document, preserving the fields required for the filter. Your Document Update Handler should make sure these fields are always 
> present. This will ensure that the filter will propagate deletions properly. 

In PouchDB, this corresponds to `put()`ing a document with `_deleted: true`, rather than `remove()`ing it.

The next gotcha deserves a bit more space. I find it very counter-intuitive, and my guess is that you'll feel the same. Since you're interested in two-way replication, you want the client to not only read data, but write data as well. What you expect is that saves on the local database will get replicated to the remote database. Let's look at some code:

{% highlight js %}
this.save = function (foobar) {
  return localDB.get(foobar._id).then(function (doc) {
    doc.someNiceField = foobar.someNiceField;
    return localDB.put(doc);
  });
};
{% endhighlight %}

In ORM parlance, this is a "connected scenario" update. You retrieve the document from the local database, you change the fields you need to change, then you put it back into the local database.

If you followed this post step-by-step, however, this won't work. Why? To make two-way filtered replication work, the design document needs to be in both the remote database and the local database. To do this, we might decide to simply replicate the design document alongside the other documents. Hence our design document becomes:

{% highlight js %}
{
  "_id": "_design/app",
  "filters": {
    "by_agent": function(doc, req) {
      return doc._id === '_design/app' || doc.agent === req.query.agent;
    }.toString()
  }
}
{% endhighlight %}

It is enough to have it stored locally; Pouch will handle the rest. The downside is that now we need to remember to handle the design document, by not letting it mingle with the documents needed in the UI.

If you feel you'd rather keep the filter function clean and not worry about filtering the design document itself, then you could also have two different design documents by the same id, one in Couch and one in Pouch, not replicating.

### Conclusion

With the new trend of offline-first apps and microservices, data replication has become the norm, even for boring CRUD apps. Rolling out your set of webservices, push notifications, or background services might give you more control, but at the same time it will force you to engineer, write, test, and maintain a whole new ecosystem.

And still, two-way replication is as much about a new set of tools as it is a new way of thinking. In offline-first apps, for example, as the number of edge cases regarding the user interaction with data multiplies, so do the possibilities for conflicts between documents.

So is it worth it? CouchDB + PouchDB make an excellent, almost turnkey solution by taming a good number of use cases. My hope is that this short post will make your own transition easier.
