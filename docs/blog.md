---
layout: default
title: Blog
---

<article class='container'>
<div class='row'>
<div class='col-md-8'>
{% for page in site.posts %}

<a class='h3' href='{{ site.baseurl }}{{ page.url }}'>{{ page.title }}: {{ page.sub_title }}</a>
{% include post_details.html %}

{% endfor %}
</div>
</div>
</article>
