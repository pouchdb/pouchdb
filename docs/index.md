---
layout: default
title: PouchDB, the JavaScript Database that Syncs!
---

<h1 id="the_database_that_syncs">The Database that Syncs!</h1>

<div id="home1">

<section>

<p>PouchDB was written to help web developers build applications that work as well offline as well as they do online, applications save data locally so the user can use all the features of an app even while offline and synchronise the data between clients so they have up to date data wherever they go.</p>

<p>PouchDB is Open Source, written in Javascript and inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a>, it is designed to be lightweight and easily embeddable.</p>

<!--<ul id="news">
  {% for post in site.posts %}
    <li>
      <small>{{ post.date | date_to_string }}</small>
      <a href="{{ post.url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
</ul>-->

</section>

<section>

{% highlight js linenos=table %}
var db = new PouchDB('dbname');

db.put({
 _id: 'dave@gmail.com',
 name: 'David',
 age: 66
});

db.changes({
  onChange: function() {
    console.log('Ch-Ch-Changes');
  }
});

db.replicate.to('http://example.com/mydb');
{% endhighlight %}

</section></div>


<div id="home2">

<section>
  <h2>Cross Browser</h2>
  Works in Firefox, Chrome, Opera, Safari, IE and Node.js
</section>

<section>
  <h2>Lightweight</h2>
  PouchDB is just a script tag and 65KB away in the browser, or<br /> <code>$ npm install pouchdb</code> away
  in node.
</section>

<section id="learn-more">
  <h2><a href="learn.html">Learn More &raquo;</a></h2>
</section>

</div>