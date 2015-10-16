---
layout: 2ColLeft
title: Getting Started Guide
sidebar: nav.html
---

{% include alert/start.html variant="info" %}

If you get stuck, download a <a href="https://github.com/nickcolley/getting-started-todo/archive/master.zip" target="_blank">working version</a>,
or check out the <a href="https://github.com/nickcolley/getting-started-todo" target="_blank">full repo</a>
and <a href="https://github.com/nickcolley/getting-started-todo/commits/master" target="_blank">commit history</a>.

{% include alert/end.html %}

In this tutorial we will write a basic Todo web application based on [TodoMVC](http://todomvc.com/) that syncs to an online CouchDB server. It should take around 10 minutes.

{% include anchor.html class="h3" title="Video Tutorial" hash="video_tutorial" %}

Prefer video tutorials? This guide is available in video format:

{% include iframe.html src="//www.youtube.com/embed/-Z7UF2TuSp0" %}

{% include anchor.html class="h3" title="Download Assets" hash="download" %}

We will start with a template of the project where all the data related functions have been replaced with empty stubs. Download and unzip [pouchdb-getting-started-todo.zip]({{ site.baseurl }}/static/assets/pouchdb-getting-started-todo.zip). When dealing with XHR and IndexedDB you are better off running web pages from a server as opposed to a filesystem. To do this you can run:

{% highlight bash %}
$ cd pouchdb-getting-started-todo
$ python -m SimpleHTTPServer
{% endhighlight %}

Then visit [http://127.0.0.1:8000/](http://127.0.0.1:8000/). If you see the following screenshot, you are good to go:

{% include img.html src="screenshots/todo-1.png" alt="Todo Screenshot" %}

It's also a good idea to open your browser's console so you can see any errors or confirmation messages.

{% include anchor.html class="h3" title="Installing PouchDB" hash="installing_pouchdb" %}

Open `index.html` and include PouchDB in the app by adding a script tag:

{% highlight html %}
<script src="//cdn.jsdelivr.net/pouchdb/{{site.version}}/pouchdb.min.js"></script>
<script src="js/base.js"></script>
<script src="js/app.js"></script>
{% endhighlight %}

PouchDB is now installed in your app and ready to use! (In production, you should use a local copy of the script.)

{% include anchor.html class="h3" title="Creating a database" hash="creating_a_database" %}

The rest of the work will be done inside `app.js`. We will start by creating a database to enter your todos. To create a database simply instantiate a new PouchDB object with the name of the database:

{% highlight js %}
// EDITING STARTS HERE (you dont need to edit anything above this line)

var db = new PouchDB('todos');
var remoteCouch = false;
{% endhighlight %}

You don't need to create a schema for the database. After giving it a name, you can immediately start writing objects to it.

{% include anchor.html class="h3" title="Write todos to the database" hash="write_todos_to_database" %}

The first thing we shall do is start writing items to the database. The main input will call `addTodo` with the current text when the user presses `Enter`. We can complete this function with the following code:

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

In PouchDB each document is required to have a unique `_id`. Any subsequent writes to a document with the same `_id` will be considered updates. Here we are using a date string as an `_id`. For our use case, it will be unique, and it can also be used to sort items in the database. You can use `db.post()` if you want random ids. The `_id` is the only thing required when creating a new document. The rest of the object you can create as you like.

The `callback` function will be called once the document has been written (or failed to write). If the `err` argument is not null, then it will have an object explaining the error, otherwise the `result` will hold the result.

{% include anchor.html class="h3" title="Show items from the database" hash="show_database_items" %}

We have included a helper function `redrawTodosUI` that takes an array of todos to display, so all we need to do is read the todos from the database. Here we will simply read all the documents using `db.allDocs`. The `include_docs` option tells PouchDB to give us the data within each document, and the `descending` option tells PouchDB how to order the results based on their `_id` field, giving us newest first.

{% highlight js %}
function showTodos() {
  db.allDocs({include_docs: true, descending: true}, function(err, doc) {
    redrawTodosUI(doc.rows);
  });
}
{% endhighlight %}

Once you have included this code, you should be able to refresh the page to see any todos you have entered.

{% include anchor.html class="h3" title="Update the UI" hash="update_the_ui" %}

We dont want to refresh the page to see new items. More typically you would update the UI manually when you write data to it, however, in PouchDB you may be syncing data remotely, so you want to make sure you update whenever the remote data changes. To do this we will call `db.changes` which subscribes to updates to the database, wherever they come from. You can enter this code between the `remoteCouch` and `addTodo` declaration:

{% highlight js %}
var remoteCouch = false;

db.changes({
  since: 'now',
  live: true
}).on('change', showTodos);

// We have to create a new todo document and enter it in the database
function addTodo(text) {
{% endhighlight %}

So every time an update happens to the database, we redraw the UI to show the new data. The `live` flag means this function will continue to run indefinitely. Now try entering a new todo and it should appear immediately.

{% include anchor.html class="h3" title="Edit a todo" hash="edit_a_todo" %}

When the user checks a checkbox, the `checkboxChanged` function will be called, so we'll fill in the code to edit the object and call `db.put`:

{% highlight js %}
function checkboxChanged(todo, event) {
  todo.completed = event.target.checked;
  db.put(todo);
}
{% endhighlight %}

This is similiar to creating a document, however the document must also contain a `_rev` field (in addition to `_id`), otherwise the write will be rejected. This ensures that you dont accidently overwrite changes to a document.

You can test that this works by checking a todo item and refreshing the page. It should stay checked.

{% include anchor.html class="h3" title="Delete an object" hash="delete_an_object" %}

To delete an object you can call db.remove with the object.

{% highlight js %}
function deleteButtonPressed(todo) {
  db.remove(todo);
}
{% endhighlight %}

Similiar to editing a document, both the `_id` and `_rev` properties are required. You may notice that we are passing around the full object that we previously read from the database. You can of course manually construct the object, like: `{_id: todo._id, _rev: todo._rev}`, but passing around the existing object is usually more convenient and less error prone.

{% include anchor.html class="h3" title="Complete rest of the Todo UI" hash="complete_todo_ui" %}

`todoBlurred` is called when the user edits a document. Here we'll delete the document if the user has entered a blank title, and we'll update it otherwise.

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

{% include anchor.html class="h3" title="Installing CouchDB" hash="installing_couchdb" %}

Now we'll implement the syncing. You need to have a CouchDB instance, which you can either install yourself [CouchDB(1.3+) locally](http://couchdb.apache.org/) or use with an online provider like [IrisCouch](http://iriscouch.com).

{% include anchor.html class="h3" title="Enabling CORS" hash="enabling_cors" %}

To replicate directly with CouchDB, you need to make sure CORS is enabled. Only set the username and password if you have set them previously. By default, CouchDB will be installed in "Admin Party," where username and password are not needed. You will need to replace `myname.iriscouch.com` with your own host (`127.0.0.1:5984` if installed locally):

You can enable CORS in CouchDB using `curl` or the Futon web interface, but we've saved you some time by making a Node script called [add-cors-to-couchdb](https://github.com/pouchdb/add-cors-to-couchdb). Just run:

{% highlight bash %}
$ npm install -g add-cors-to-couchdb
$ add-cors-to-couchdb
{% endhighlight %}

Or if your database is not at `127.0.0.1:5984`:

{% highlight bash %}
$ add-cors-to-couchdb http://me.iriscouch.com -u myusername -p mypassword
{% endhighlight %}

You can check that CORS is now enabled by visiting [http://localhost:5984/_utils/config.html](http://localhost:5984/_utils/config.html) in your browser. You should see something like this:

{% include img.html src="cors_in_couchdb.png" alt="CORS settings in CouchDB" %}

{% include anchor.html class="h3" title="Implement basic two way sync" hash="basic_two_way_sync" %}

Now we will have the todo list sync. Back in `app.js` we need to specify the address of the remote database. Remember to replace `user`, `pass` and `myname.iriscouch.com` with the credentials of your own CouchDB instance:

{% highlight js %}
// EDITING STARTS HERE (you dont need to edit anything above this line)

var db = new PouchDB('todos');
var remoteCouch = 'http://user:pass@mname.iriscouch.com/todos';
{% endhighlight %}

Then we can implement the sync function like so:

{% highlight js %}
function sync() {
  syncDom.setAttribute('data-sync-state', 'syncing');
  var opts = {live: true};
  db.replicate.to(remoteCouch, opts, syncError);
  db.replicate.from(remoteCouch, opts, syncError);
}
{% endhighlight %}

`db.replicate()` tells PouchDB to transfer all the documents `to` or `from` the `remoteCouch`. This can either be a string identifier or a PouchDB object. We call this twice: once to receive remote updates, and once to push local changes. Again, the `live` flag is used to tell PouchDB to carry on doing this indefinitely. The callback will be called whenever this finishes. For live replication, this will mean an error has occured, like losing your connection or you canceled the replication.

You should be able to open [the todo app](http://127.0.0.1:8000) in another browser and see that the two lists stay in sync with any changes you make to them. You may also want to look at your CouchDB's Futon administration page and see the populated database.

{% include anchor.html class="h3" title="Congratulations!" hash="congratulations" %}

You've completed your first PouchDB application. This is a basic example, and a real world application will need to integrate more error checking, user signup, etc. But you should now understand the basics you need to start working on your own PouchDB project. If you have any more questions, please get in touch on [IRC](irc://freenode.net#pouchdb) or the [mailing list](https://groups.google.com/forum/#!forum/pouchdb).
