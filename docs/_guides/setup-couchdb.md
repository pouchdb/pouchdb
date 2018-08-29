---
index: 2
layout: guide
title: Setting up CouchDB
sidebar: guides_nav.html
---

{% include anchor.html title="CouchDB: PouchDB's older sibling" hash="couchdb-pouchdbs-older-sibling" %}

One of the main benefits of learning PouchDB is that it's exactly the same as CouchDB. In fact, PouchDB is a shameless plagiarist: all of the API methods are the same, with only slight modifications to make it more JavaScript-y.

For instance, in CouchDB you would fetch all documents using:

    /db/_all_docs?include_docs=true

In PouchDB this becomes:

```js
db.allDocs({include_docs: true})
```

The APIs are the same, and the semantics are the same.

In the following examples, we will set up CouchDB and talk to it using a tool you're already familiar with: your browser.

{% include anchor.html title="Installing CouchDB" hash="installing-couchdb" %}

If you are on a Debian flavor of Linux (Ubuntu, Mint, etc.), you can install CouchDB with:

```
$ sudo apt-get install couchdb
```

If you are on a Mac or Windows you should install the official binaries from [the CouchDB web site](https://couchdb.apache.org/#download).

#### A CouchDB alternative: PouchDB Server

If you have trouble installing CouchDB, you can also install PouchDB Server, which is a drop-in replacement for CouchDB that uses PouchDB under the hood:

```
$ npm install -g pouchdb-server
$ pouchdb-server --port 5984
```

PouchDB Server is currently experimental, and we do not recommend it for production environments.

{% include anchor.html title="Verify your installation" hash="verify-your–installation" %}

Once CouchDB is installed, it should be running at `localhost:5984`. To verify, you can open up your terminal and type

```
$ curl localhost:5984
```

You should see something like:

```js
{"couchdb":"Welcome","version":"2.2.0",...}
```

Next, open up [http://localhost:5984/_utils/](http://localhost:5984/_utils/) in your browser.

If you see a screen like the following, then you are ready to rock and roll with CouchDB:


{% include img.html src="fauxton.png" alt="Fauxton interface" %}

{% include anchor.html title="Set up CORS" hash="set-up-cors" %}

[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS) is a web technology that allows web sites to use resources from another domain. You will want to enable this in your CouchDB before continuing, because otherwise PouchDB will not work unless it's served from exactly the same domain as CouchDB.

Enabling CORS is easy. Just install this handy script:

    $ npm install -g add-cors-to-couchdb

And run it:

    $ add-cors-to-couchdb

If you installed PouchDB Server, CORS is enabled by default, and this step is not necessary.

{% include anchor.html title="Next" hash="next" %}

Now that you have CouchDB installed, let's install PouchDB.
