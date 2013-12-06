---
layout: default
title: PouchDB, the JavaScript Database that Syncs!
---

<h1 id="the_database_that_syncs">The Database that Syncs!</h1>

<div id="home1">

<section>

<p>PouchDB is an Open Source JavaScript Database inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a> that is designed to run well within the browser.</p>

<p>PouchDB was created to help web developers build applications that work equally as well offline as they do online. It enables applications to store data locally while offline, and synchronise it with CouchDB and compatible servers when the application is back online, keeping the user's data in sync no matter where they next login.</p>

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
  PouchDB is just a script tag and 25KB(gzipped) away in the browser, or<br /> <code>$ npm install pouchdb</code> away
  in node.
</section>

<section id="learn-more">
  <h2><a href="learn.html">Learn More &raquo;</a></h2>
</section>

</div>
