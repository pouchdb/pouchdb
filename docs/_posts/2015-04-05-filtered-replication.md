---
layout: post

title: Server-side filtered replication: from Couch to Pouch and back

author: Giovanni Ornaghi

---

Filtered replication can become a vital feature for many applications where you realize you don't need the whole dataset to be replicated to each client. At the same time, filtered replication can be the wrong solution to your problem if:
* you're trying to address security concerns: replicating only the user's documents might make for a nice experience, but it doesn't substitute authorization strategies
* there's no big security issue, but you'd like to provide a better per user or per role experience. There's no shame in creating a DB per user or DB per role! Nolan Lawson discussed such recipes [here](https://github.com/nolanlawson/pouchdb-authentication#couchdb-authentication-recipe)

So what is filtered replication good for? One use case is apparent: you want to give your users only a certain amount of documents, the choice might not take into account their identity or roles. Sometimes documents need to be shared by multiple users with real-time feedback, so you cannot implement a DB per user solution, oftentimes these groups of users are too volatile to effectively implement a DB per role solution. 

### Filters in PouchDB

In the PouchDB world there are two shapes of filtered replication:
* Client-side filtering takes nothing more than a JS function, it will prevent useless documents to be stored locally, but this means the documents will still go over the wire and the client will waste CPU cycles to handle them properly
* Server-side filtering, again, takes nothing more than a JS function, but it's executed by Couch. This will prevent documents to go over the wire in the first place!

While in the example design document (and the Javascript snippets) I'm using a filter, the rest of this post will hold if you decide to use a view instead. At this point you might be wondering what's the difference between a view and a filter. I see questions about "using views as filters" a lot. My reason for using filters is easy: I want to emit the whole document, and I want to emit documents according to a parameter provided by the client. While you could create a view that emits the whole document, taking parameters becomes a bit too complicated for my taste (e.g. see: [CouchDB Cookbook](http://guide.couchdb.org/editions/1/en/cookbook.html)). 

### A simple implementation

{% include alert/start.html variant="info" %}
To reproduce the examples you’ll need a nightly build of PouchDB, currently v.3.3.1 is still a bit buggy when it comes to filtered replication.
{% include alert/end.html %}

The first step in implementing your server-side filtering solution is to create the design document. This is an example:

{% highlight js %}
{
   "_id": "_design/app",
   "_rev": 1-3bf660a934d6677b1214b8161dfc9e9e,
   "filters": {
       "by_agent": "function(doc, req) { return (doc.Code && doc.Code == req.query.agent);}"
   }
}
{% endhighlight %}

Filters in CouchDB are like filters as higher-order functions: they take some arguments and return true or false. 

We'll come back to this design document later. Now it's time to implement our client-side logic. By reading the awesome [API docs](http://pouchdb.com/api.html#replication) we see that `sync` has various options: 
* `filter`: can take either the string corresponding to the filter function (see example below), or a JS function (for client-side filtering)
* `query_params`: takes a JS object. This object is what we find in the "req.query" object inside the design document function
Just what we need!

{% highlight js %}
localDB.sync(remoteDB, {
            live: true,
            retry: true,
            filter: 'app/by_agent',
            query_params: { "agent": agent }
        })
        .on('change', function(result){
                result.change.docs.forEach(function(change) {
                    if(!change.deleted){
                            //upsert
                    } else {
                            //remove
                    }
            });
    });
{% endhighlight %}

We're doing a two-way replication (from Couch to Pouch and back), using a filter (in our faithful design document) all in real-time (see `live` and `retry` options). Couch will give us a batch of documents from the `_changes` feed which we then iterate and manage according to our needs.

### Caveats

Now, this looks easy, and it is, but there are a few gotchas:
* since we're doing live replication, the `complete` event will not trigger, use `paused` instead
* documents will come in batches, you might not get the whole `_changes` feed at once
* you cannot really delete documents in the local storage. Purging is a feature the PouchDB team is still working on
* if you change something on the document server-side that won't make the document pass the filter, the document won't pass the filter. Crazy right? CouchDB won't check on the last two versions of the document, just the last one. This simply means that those documents will persist on the client and never be present in the `_changes` feed
* watch how you delete your documents! Simply going into Futon and happily clicking "Delete Document..." won't replicate the deletion. What you want to do is update the document adding a `_deleted: true` field. From the [CouchDB docs](https://wiki.apache.org/couchdb/Replication) (nice find Nolan!):

> Note: When using filtered replication you should not use the DELETE method to remove documents, but instead use PUT and add a `_deleted:true`
> field to the document, preserving the fields required for the filter. Your Document Update Handler should make sure these fields are always 
> present. This will ensure that the filter will propagate deletions properly. 

The next gotcha deserves a bit more space, I find it very counter-intuitive and my guess is that you'll feel the same. Since you're interested in two-way replication, you want the client to not only read data, but write data as well. What you expect is that saves on the localDB will get replicated to the remoteDB. Let's look at some code:

{% highlight js %}
this.save = function(bolla){
    return localDB.get(bolla._id).then(function(doc){
        doc.SomeNiceField = bolla.SomeNiceField;
        return localDB.put(doc);
    });
};
{% endhighlight %}

In ORM parlance, this is a "connected scenario" update. You retrieve the document from the localDB, you change the fields you need to change, you put it back into the localDB. If you followed this post step-by-step, however, this won't work. Why? To make two-way filtered replication work the design document needs to be in both the remoteDB and the localDB. To do this we might decide to simply replicate the design document along the other documents. Hence our design document becomes:

{% highlight js %}
{
   "_id": "_design/app",
   "_rev": 1-3bf660a934d6677b1214b8161dfc9e9e,
   "filters": {
       "by_agent": "function(doc, req) { return (doc._id == '_design/app' || (doc.Code && doc.Code == req.query.agent));}"
   }
}
{% endhighlight %}

Now we need to remember to handle the design document by not having it mingle with the documents needed in the UI. It is enough to have it stored locally, Pouch will handle the rest. You might even want to have two different design documents by the same id, one in Couch and one in Pouch, not replicating. My intuition is that by having it only in the remote database I avoid duplicating code, but if you feel you'd rather keep the filter function clean and not worry about documents in the UI, go ahead and put the JSON in the localDB.

### Conclusions

With the new trend of offline-first apps and microservices, data replication became the norm even for us boring CRUD developers. Rolling out your set of webservices, push notifications, or background services might give you more control, at the same time it will force you to engineer, write, test, and maintain a whole new ecosystem. And still, two-way replication is as much about a new set of tools as it is a new way of thinking. In offline-first apps, for example, the number of edge cases regarding the user interaction with data multiplies, so do the possibilities for conflicts between documents. Is it worth it? CouchDB+PouchDB make an excellent almost turnkey solution by taming a good number of use cases. My hope is that this short post will make your transition easier.
