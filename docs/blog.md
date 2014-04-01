---
layout: default
title: Blog
---

<article class='container'>
<div class='row'>
<div class='col-md-8'>
{% for post in site.posts %}

<a class='h3' href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a>
{% include post_details.html %}

{% endfor %}
</div>
</div>
</article>
