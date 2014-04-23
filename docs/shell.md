---
layout: minimal
title: Try PouchDB
---

<div class='container' style="position: relative">
  <div id="tutorial-navigation">
    <a id="repl-back">back</a>
    <a id="repl-next">next</a>
  </div>
  <div id="tutorial-wrapper"></div>
</div>


<script type="template/html" id="repl-1" class="repl">
  <h4>Interactive PouchDB tutorial</h4>

  <p>Welcome to the PouchDB playground, we have based this on your
    browsers console so to get started you will need to open that up. You can
    progress through an interactive tutorial by typing <code>next</code> at
    any point, <code>back</code> will take you back and if you get stuck
    you can type <code>help</code>.
  </p>

  <h4>Open Web Console:</h4>
  <p>Firefox: <kbd>Control</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> or for a mac:
    <kbd>cmd</kbd> + <kbd>alt</kbd> + <kbd>K</kbd></p>
  <p>Chrome: <kbd>Control</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd> or for a mac:
    <kbd>cmd</kbd> + <kbd>alt</kbd> + <kbd>J</kbd></p>

  <p>Now type <code>next</code> in the console to go to the next stage of the
    tutorial</p>

</script>


<script type="template/html" id="repl-2" class="repl">
  <h4>Create a database:</h4>
  <p>To create a database you call the <code>PouchDB</code> constructor with the
    name of a database</p>
{% highlight js %}
> var db = new PouchDB('test');
{% endhighlight %}
</script>


<script type="template/html" id="repl-3" class="repl">
  <h4>Store Data:</h4>
  <p>To store data</p>
{% highlight js %}
> db.post({a: 'doc'});
{% endhighlight %}
</script>


<script src="http://cdn.jsdelivr.net/pouchdb/2.1.2/pouchdb.min.js"></script>
<script src="/static/js/repl.js"></script>
<script src="/static/js/repl-app.js"></script>
