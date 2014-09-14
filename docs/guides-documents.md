---
layout: 2ColLeft
title: Working with documents
sidebar: guides_nav.html
---

What's a document?
-------

PouchDB is a NoSQL database, meaning that you store unstructured *documents* rather than explicitly specifying a schema with rows, tables, and all that jazz.

A document might look like this:

```js
{
  "_id": "mittens",
  "name": "Mittens",
  "occupation": "kitten",
  "age": 3,
  "hobbies": [
    "playing with balls of yarn",
    "chasing laser pointers",
    "lookin' hella cute"
  ]
}
```

If you come from a SQL background, this handy conversion chart may help:

<div class="table-responsive">
<table class="table">
<tr>
  <th>SQL concept</th>
  <th>PouchDB concept</th>
</tr>
<tr>
  <td>table</td>
  <td>database</td>
</tr>
<tr>
  <td>row</td>
  <td>document</td>
</tr>

<tr>
  <td>column</td>
  <td>field</td>
</tr>
<tr>
  <td>primary key</td>
  <td>primary key (<code>_id</code>)</td>
</tr>
<tr>
  <td>index</td>
  <td>view</td>
</tr>
</table>
</div>

We'll discuss more of these concepts later on.

Storing documents
-------------

