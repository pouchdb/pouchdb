---
index: 1
layout: guide
nav: Intro
title: Introduction to PouchDB
sidebar: guides_nav.html
---

Welcome to the PouchDB guide! Consider this your starting point for anything and everything related to the world of PouchDB and CouchDB.

For a quicker TodoMVC-based tutorial, you can also check out the ["Getting Started" guide](/getting-started.html).

Feel free to skip ahead using the sidebar at any time.

What is PouchDB?
------

**PouchDB** is a JavaScript implementation of [CouchDB](http://couchdb.com). Its goal is to emulate the CouchDB API with near-perfect fidelity, while running in the browser or in Node.js.

What is CouchDB?
---------

**CouchDB** is a NoSQL database created in 2005 by Damien Katz, and now maintained by the Apache Software Foundation.  If you are a JavaScript developer, you probably use CouchDB every day, because it's the core technology that powers [npm](https://www.npmjs.org/).

Couchbase, CouchDB, Couch-wha?
----------

Today there are two major database companies that
can trace their lineage back to CouchDB: [**Couchbase**](http://couchbase.com) and [**Cloudant**](http://cloudant.com). Both of them are separate products compared to CouchDB.

However, all three of these databases share the same **CouchDB sync protocol**. This means that PouchDB can sync with either one of them, and you can always swap out one database for another. You're never locked in.

In a sense, these databases are like competing phone companies, and the CouchDB sync protocol is the underlying telephony infrastructure.

CouchDB's one-two punch: HTTP and sync
----------

With so many SQL and NoSQL databases out there &ndash; MongoDB, PostgreSQL, MySQL, etc. &ndash; you may wonder why we chose to implement CouchDB instead of the others.

We have two very good answers to that question: **HTTP** and **sync**.

HTTP: the little protocol that could
-----
When working with databases, we're often accustomed to writing some kind of conversion layer between the database and our client-side applications. This means, however, that we are just translating database queries into RESTful HTTP calls, over and over. For every app we write.

CouchDB throws this out the window by daring us to talk to the database directly, from our client-side apps. And it does so by using HTTP as its primary means of communication. No special protocol, no special drivers: just REST and HTTP. You can communicate with CouchDB entirely through your browser, `curl`, or a REST client like [Postman](https://chrome.google.com/webstore/detail/postman-rest-client/fdmmgilgnpjigdojojpjoooidkmcomcm).

In this way, CouchDB truly is a "database for the web."

Sync: CouchDB's killer feature
-----

Another unique feature of CouchDB is that it was designed from the bottom-up to enable easy synchronization between different databases.

For example, if you are worried about latency in your client-side applications, you can simply set up one CouchDB in Europe, another in North America, and another in Asia. After enabling continuous two-way replication between these databases, your clients can simply talk to whichever one is closer.

PouchDB takes this one step further by putting the database inside your browser.

Next
-----

Now that you understand the basics of the PouchDB/CouchDB universe, let's set up CouchDB!
