----
layout: default
title: Simple todo list with sync
----

# Simple todo list with sync

This short tutorial shows the very simple application using pouchdb. It replaces [todomvc todos’](http://todomvc.com/vanilla-examples/vanillajs/) localStorage with pouchdb.

First you need to start with cloning pouchdb:

    https://github.com/daleharvey/pouchdb

After that we go straight away to our example todo-list located in tutorials.

To run it - due to [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) - you need to put it onto your webserver or start your own. If you have python2 just try: (http.server in python 3)

    python2 -m SimpleHTTPServer 8888

Then simply run our example: [http://localhost:8888](http://localhost:8888). Unfortunately, sync doesn’t work yet.

## Sync

More difficult part concerns couchdb server we want to sync our data to.

If you already have one - you just simply edit the remove variable in app.js file. (you need to create database called todos)

Otherwise, follow [couchdb’s tests](https://github.com/daleharvey/pouchdb/wiki/Running-and-Writing-Tests) tutorial to get couchdb and cors-server up and running. Create todos database and you are ready to go.

