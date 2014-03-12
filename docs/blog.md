---
layout: default
---
<article class='container'>
<h1>Blog</h1>

{% for page in site.posts %}

<a class='h3' href='{{ site.baseurl }}{{ page.url }}'>{{ page.title }}: {{ page.sub_title }}</a>
{% include post_details.html %}

{% endfor %}

</article>