How to contribute to pouchdb-find
=======

Cloudant setup
-------

Right now Mango queries are only supported by Cloudant. So I use a Cloudant account to do all the HTTP testing.

To hook up your own Cloudant account, just run:

```
# yes, you need all these environment vars
export CLOUDANT_HOST=something.cloudant.com
export CLOUDANT_USERNAME=myusername
export CLOUDANT_PASSWORD=mypassword
export COUCH_HOST=http://$CLOUDANT_USERNAME:$CLOUDANT_PASSWORD@$CLOUDANT_HOST

# writes the javascript files we need
npm run write-cloudant-password
```

**Note**: you should probably put these commands into a file and `source` them so that the password doesn't show up in your bash history.

When it runs in Travis, it uses the credentials for `pouch.cloudant.com`, which is a special database for Pouch stuff donated by Cloudant.

Building
----
    npm install
    npm run build

Your plugin is now located at `dist/pouchdb.find.js` and `dist/pouchdb.find.min.js` and is ready for distribution.

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage

### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL.
