---
layout: default
title: PouchDB, the JavaScript Database that Syncs!
---

<div class="band band-inverse">

  <div class="container">

    <div class="row">

      <div class='col-sm-6'>

        <h1>The Database that Syncs!</h1>

        <p>PouchDB is an open-source JavaScript database inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a> that is designed to run well within the browser.</p>

        <p>PouchDB was created to help web developers build applications that work as well offline as they do online.<br>
        <p>It enables applications to store data locally while offline, then synchronize it with CouchDB and compatible servers when the application is back online, keeping the user's data in sync no matter where they next login.</p>

        <a href="{{ site.baseurl }}/learn.html" class="btn btn-primary btn-lg btn-block-xs">Learn more</a>

      </div>

      <div class='col-sm-6'>

{% highlight js %}
var db = new PouchDB('dbname');

db.put({
  _id: 'dave@gmail.com',
  name: 'David',
  age: 69
});

db.changes().on('change', function() {
  console.log('Ch-Ch-Changes');
});

db.replicate.to('http://example.com/mydb');
{% endhighlight %}

      </div>

    </div>

  </div>

</div>

<div class="band">

  <div class="container">

    <div class='row'>


      <div class='text-center col-sm-6 col-md-3'>

        <img
          class="icon icon-lg"
          src="{{ site.base_url }}/static/img/index/node.svg"
          alt=""
        />

        <h3>Cross Browser</h3>
        <p class="margin-bottom-none-md">Works in Firefox, Chrome, Opera, Safari, IE and Node.js</p>

      </div>

      <div class='text-center col-sm-6 col-md-3'>

        <img
          class="icon icon-lg"
          src="{{ site.base_url }}/static/img/index/light.svg"
          alt=""
        />

        <h3>Lightweight</h3>
        <p class="margin-bottom-none-md">PouchDB is just a script tag and 46KB (gzipped) away in the browser, or <code>$ npm install pouchdb</code> away
        in Node.</p>

      </div>

      <div class='text-center col-sm-6 col-md-3'>

        <img
          class="icon icon-lg"
          src="{{ site.base_url }}/static/img/index/learn.svg"
          alt=""
        />

        <h3>Easy to Learn</h3>
        <p class="margin-bottom-none-md">Requires some programming knowledge, however PouchDB is a piece of cake to learn.</p>

      </div>

      <div class='text-center col-sm-6 col-md-3'>

        <img
          class="icon icon-lg"
          src="{{ site.base_url }}/static/img/index/open.svg"
          alt=""
        />

        <h3>Open Source</h3>
        <p class="margin-bottom-none-md">Everything is developed out in the open on GitHub, contributors always welcome!</p>

      </div>

    </div>
  </div>

</div>

<div class="band band-inverse">

  <div class="container">

    <h3>Latest</h3>

        <div class="row">

{% for post in site.posts limit:2 %}

<div class="col-md-6">


  <p class="margin-bottom-none"><a class='h4' href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a></p>

{% include post_details.html %}

  </div>

{% endfor %}

   </div>

<a class="btn btn-primary btn-lg" href="/blog/index.html">View more</a>

  </div>

</div>
