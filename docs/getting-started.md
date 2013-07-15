---
layout: learn
title: PouchDB, the JavaScript Database that Syncs!
---

# Getting Started Guide

In this tutorial we will write a basic Todo web application based on [TodoMVC](http://todomvc.com/) that syncs to an online CouchDB server. It should take around 10 minutes.

# Download Assets

We will start with a template of the project where all the data related functions have been replaced with empty stubs, download and unzip [pouchdb-getting-started-todo.zip](/static/assets/pouchdb-getting-started-todo.zip). When dealing with XHR and IndexedDB you are better running web pages from a server as opposed to a filesystem, to do this you can run:

{% highlight bash %}
$ cd pouchdb-getting-started-todo
$ python -m SimpleHTTPServer
{% endhighlight %}

Then visit [http://127.0.0.1:8000/](http://127.0.0.1:8000/), if you see the following screenshot, you are good to go:

<a href="/static/screenshots/todo-1.png" style="display: block; text-align: center;">
   <img src="/static/screenshots/todo-1.png" style="width:400px;"/>
</a>

It wont do anything at this point, but it is a good idea to open your browsers console so you can see any errors or confirmation messages.

# Installing PouchDB

Open `index.html` and include PouchDB in the app by adding a script tag:

{% highlight html %}
<script src="http://download.pouchdb.com/pouchdb-nightly.js"></script>
<script src="js/base.js"></script>
<script src="js/app.js"></script>
{% endhighlight %}

PouchDB is now installed in your app and ready to use (In production you should copy a version locally and use that).

# Creating a database

The rest of the work will be done inside `app.js`. We will start by creating a database to enter your todos, to create a database simply instantiate a new PouchDB object with the name of the database:

{% highlight js %}
// EDITING STARTS HERE (you dont need to edit anything above this line)

var db = new PouchDB('todos');
var remoteCouch = false;
{% endhighlight %}

You dont need to create a schema the database, you simply give it a name and you can start writing objects to it.

# Write todos to the database

The first thing we shall do is start writing items to the database, the main input will call `addTodo` with the current text when the user presses `Enter`, we can complete this function will the following code:

{% highlight js %}
function addTodo(text) {
  var todo = {
    _id: new Date().toISOString(),
    title: text,
    completed: false
  };
  db.put(todo, function callback(err, result) {
    if (!err) {
      console.log('Successfully posted a todo!');
    }
  });
}
{% endhighlight %}

In PouchDB each document is required to have a unique `_id`, any subsequent writes to a document with the same `_id` will be considered updates, here we are using a date string as for this use case will be unique and it can also be used to order items by date entered (you can use `Pouch.uuids()` or `db.post()` if you want random ids). The `_id` is the only thing required when creating a new document, the rest of the object you can create as you like.

The `callback` function will be called once the document has been written (or failed to write). If the `err` argument is not null then it will have an object explaining the error, otherwise the `result` will hold the result.

# Show items from the database

We have included a helper function `redrawTodosUI` here that takes an array of todos to display so we just need to read them from the database, here we will simply read all the documents using `db.allDocs`, the `include_docs` option tells PouchDB to give us the data within each document and the `descending` option tells PouchDB how to order the results based on their `_id` field, giving us newest first.

{% highlight js %}
function showTodos() {
  db.allDocs({include_docs: true, descending: true}, function(err, doc) {
    redrawTodosUI(doc.rows);
  });
}
{% endhighlight %}

Once you have included this code you should be able to refresh the page to see any todos
you have entered.

# Update the UI

We dont want to refresh the page to see new items, more typically you would update the UI manually when you write data to it, however in PouchDB you may be syncing data remotely and want to make sure you update when the remote data changes to do this we will call `db.changes` which subscribes to updates to the database wherever they come from. You can enter this code between the `remoteCouch` and `showTodos` declaration:

{% highlight js %}
var remoteCouch = false;

db.info(function(err, info) {
  db.changes({
    since: info.update_seq,
    continuous: true,
    onChange: showTodos
  });
});

// Show the current list of todos by reading them from the database
function showTodos() {
{% endhighlight %}

So every time an update happens to the database we will redraw the UI showing the new data, the `continuous` flag means this function will continue to run indefinitely. Now try entering a new todo and it should appear immediately.

# Edit a todo

When the user checks a checkbox the `checkboxChanged` function will be called so we shall fill in the code to edit the object and call `db.put`:

{% highlight js %}
function checkboxChanged(todo, event) {
  todo.completed = event.target.checked;
  db.put(todo);
}
{% endhighlight %}

This is similiar to creating a document however the document must also contain a `_rev` field (in addition to `_id`) otherwise the write will be rejected, this ensures that you dont accidently overwrite changes to a document.

You can test this works by checking a todo item and refreshing the page, it should stay checked.

# Delete an object

To delete an object you can call db.remove with the object.

{% highlight js %}
function deleteButtonPressed(todo) {
  db.remove(todo);
}
{% endhighlight %}

Similiarly to editing a document, both the `_id` and `_rev` properties are required. You may notice we are passing around the full object that we previously read from the database, you can of course manually construct the object like: `{_id: todo._id, _rev: todo._rev}`, passing around the existing object is usually more convenient and less error prone.

# Complete rest of the Todo UI

`todoBlurred` is called when the user edits a document, here we shall delete the document if the user has entered a blank title or update it if not.

{% highlight js %}
function todoBlurred(todo, event) {
  var trimmedText = event.target.value.trim();
  if (!trimmedText) {
    db.remove(todo);
  } else {
    todo.title = trimmedText;
    db.put(todo);
  }
}
{% endhighlight %}

# Installing CouchDB

Now we will implement the syncing, you need to have an CouchDB instance, you can either install [CouchDB(1.3+) locally](http://couchdb.apache.org/) or use an online provider like [IrisCouch](http://iriscouch.com).

# Enabling CORS

To replicate directly with CouchDB you need to make sure CORS is enabled, only set the username and password if you have set them previously, by default CouchDB will be installed in "Admin Party" and they are not needed, you will need to replace the `myname.iriscouch.com` with your own host (`127.0.0.1:5984` if installed locally):

{% highlight bash %}
$ export HOST=http://username:password@myname.iriscouch.com
$ curl -X PUT $HOST/_config/httpd/enable_cors -d '"true"'
$ curl -X PUT $HOST/_config/cors/origins -d '"*"'
$ curl -X PUT $HOST/_config/cors/credentials -d '"true"'
$ curl -X PUT $HOST/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
$ curl -X PUT $HOST/_config/cors/headers -d \
  '"accept, authorization, content-type, origin"'
{% endhighlight %}

# Implement basic two way sync

Now we will have the todo list sync, back to `app.js` we need to specify the address of the remote database, remember to replace `user`, `pass` and `myname.iriscouch.com` with the credentials of your CouchDB instance:

{% highlight js %}
// EDITING STARTS HERE (you dont need to edit anything above this line)

var db = new PouchDB('todos');
var remoteCouch = 'http://user:pass@mname.iriscouch.com/todos';
{% endhighlight %}

Then we can implement the sync function like so:

{% highlight js %}
function sync() {
  syncDom.setAttribute('data-sync-state', 'syncing');
  var opts = {continuous: true, complete: syncError};
  db.replicate.to(remoteCouch, opts);
  db.replicate.from(remoteCouch, opts);
}
{% endhighlight %}

`db.replicate()` tells PouchDB to transfer all the documents `to` or `from` the `remoteCouch`, this can either be a string identifier or a PouchDB object. We call this twice, one to receive remote updates and one to push local changes, again the `continuous` flag is used to tell PouchDB to carry on doing this indefinitely. The `complete` callback will be called whenever this finishes, for continuous replication this will mean an error has occured, losing your connection for instance.

You should be able to open [the todo app](http://127.0.0.1:8000) in another browser and see that the 2 lists stay in sync with any changes you make to them, You may also want to look at your CouchDBs Futon administration page and see the populated database.

# Congratulations!

You completed your first PouchDB application. This is a basic example and a real world application will need to integrate more error checking, user signup etc, however you should now understand the basics you need to start working on your own PouchDB project, if you have any more questions please get in touch on [IRC](irc://freenode.net#pouchdb) or the [mailing list](https://groups.google.com/forum/#!forum/pouchdb).