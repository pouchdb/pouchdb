# nano

minimalistic couchdb driver for node.js

`nano` features:

* **minimalistic** - there is only a minimum of abstraction between you and 
  couchdb
* **pipes** - proxy requests from couchdb directly to your end user
* **errors** - errors are proxied directly from couchdb: if you know couchdb 
  you already know `nano`


## installation

1. install [npm][1]
2. `npm install nano`

## getting started

to use `nano` you need to connect it to your couchdb install, to do that:

``` js
var nano = require('nano')('http://localhost:5984');
```

to create a new database:

``` js
nano.db.create('alice');
```

and to use it:

``` js
var alice = nano.db.use('alice');
```

in this examples we didn't specify a `callback` function, the absence of a 
callback means _"do this, ignore what happens"_.
in `nano` the callback function receives always three arguments:

* `err` - the error, if any
* `body` - the http _response body_ from couchdb, if no error. 
  json parsed body, binary for non json responses
* `header` - the http _response header_ from couchdb, if no error


a simple but complete example using callbacks is:

``` js
var nano = require('nano')('http://localhost:5984');

// clean up the database we created previously
nano.db.destroy('alice', function() {
  // create a new database
  nano.db.create('alice', function() {
    // specify the database we are going to use
    var alice = nano.use('alice');
    // and insert a document in it
    alice.insert({ crazy: true }, 'rabbit', function(err, body, header) {
      if (err) {
        console.log('[alice.insert] ', err.message);
        return;
      }
      console.log('you have inserted the rabbit.')
      console.log(body);
    });
  });
});
```

if you run this example(after starting couchdb) you will see:

    you have inserted the rabbit.
    { ok: true,
      id: 'rabbit',
      rev: '1-6e4cb465d49c0368ac3946506d26335d' }

you can also see your document in [futon](http://localhost:5984/_utils).

## configuration

configuring nano to use your database server is as simple as:

``` js
var server = require('nano')('http://localhost:5984')
  , db     = server.use('foo')
  ;
```

however if you don't need to instrument database objects you can simply:

``` js
// nano parses the url and knows this is a database
var db = require('nano')('http://localhost:5984/foo');
```

you can also pass options to the require:

``` js
// nano parses the url and knows this is a database
var db = require('nano')('http://localhost:5984/foo');
```

to specify further configuration options you can pass an object literal instead:

``` js
// nano parses the url and knows this is a database
var db = require('nano')(
  { "url"             : "http://localhost:5984/foo"
  , "request_options" : { "proxy" : "http://someproxy" }
  , "log"             : function (id, args) { 
      console.log(id, args);
    }
  });
```
please check [request] for more information on the defaults. they support features like cookie jar, proxies, ssl, etc.

### pool size

a very important configuration parameter if you have a high traffic website and are using nano is setting up the `pool.size`. by default the node.js http agent (client) has a certain size of active connections that can run simultaneously, while others are kept in a queue. 

you can increase the size using `request_options` if this is problematic, and refer to the [request] documentation and examples for further clarification

## database functions

### nano.db.create(name, [callback])

creates a couchdb database with the given `name`.

``` js
nano.db.create('alice', function(err, body) {
  if (!err) {
    console.log('database alice created!');
  }
});
```

### nano.db.get(name, [callback])

get informations about `name`.

``` js
nano.db.get('alice', function(err, body) {
  if (!err) {
    console.log(body);
  }
});
```

### nano.db.destroy(name, [callback])

destroys `name`.

``` js
nano.db.destroy('alice');
```

even though this examples looks sync it is an async function.

### nano.db.list([callback])

lists all the databases in couchdb

``` js
nano.db.list(function(err, body) {
  // body is an array
  body.forEach(function(db) {
    console.log(db);
  });
});
```

### nano.db.compact(name, [designname], [callback])

compacts `name`, if `designname` is specified also compacts its
views.

### nano.db.replicate(source, target, [opts], [callback])

replicates `source` on `target` with options `opts`. `target`
has to exist, add `create_target:true` to `opts` to create it prior to
replication.

``` js
nano.db.replicate('alice', 'http://admin:password@otherhost.com:5984/alice',
                  { create_target:true }, function(err, body) {
    if (!err) 
      console.log(body);
});
```

### nano.db.changes(name, [params], [callback])

asks for the changes feed of `name`, `params` contains additions
to the query string.

``` js
nano.db.changes('alice', function(err, body) {
  if (!err) {
    console.log(body);
  }
});
```

### nano.db.follow(name, [params], [callback])

uses [follow] to create a solid changes feed. please consult follow documentation for more information as this is a very complete api on it's own

``` js
var feed = db.follow({since: "now"});
feed.on('change', function (change) {
  console.log("change: ", change);
});
feed.follow();
process.nextTick(function () {
  db.insert({"bar": "baz"}, "bar");
});
```

### nano.use(name)

creates a scope where you operate inside `name`.

``` js
var alice = nano.use('alice');
alice.insert({ crazy: true }, 'rabbit', function(err, body) {
  // do something
});
```

### nano.db.use(name)

alias for `nano.use`

### nano.db.scope(name)

alias for `nano.use`

### nano.scope(name)

alias for `nano.use`

### nano.request(opts, [callback])

makes a request to couchdb, the available `opts` are:

* `opts.db` – the database name
* `opts.method` – the http method, defaults to `get`
* `opts.path` – the full path of the request, overrides `opts.doc` and
  `opts.att`
* `opts.doc` – the document name
* `opts.att` – the attachment name
* `opts.content_type` – the content type of the request, default to `json`
* `opts.headers` – additional http headers, overrides existing ones
* `opts.body` – the document or attachment body
* `opts.encoding` – the encoding for attachments

### nano.relax(opts, [callback])

alias for `nano.request`

### nano.dinosaur(opts, [callback])

alias for `nano.request`

                    _
                  / '_)  WAT U SAY!
         _.----._/  /
        /          /
      _/  (   | ( |
     /__.-|_|--|_l

### nano.config

an object containing the nano configurations, possible keys are:

* `url` - the couchdb url
* `db` - the database name

## document functions

### db.insert(doc, [params], [callback])

inserts `doc` in the database with  optional `params`. if params is a string, its assumed as the intended document name. if params is an object, its passed as query string parameters and `doc_name` is checked for defining the document name.

``` js
var alice = nano.use('alice');
alice.insert({ crazy: true }, 'rabbit', function(err, body) {
  if (!err)
    console.log(body);
});
```

### db.destroy(docname, rev, [callback])

removes revision `rev` of `docname` from couchdb.

``` js
alice.destroy('alice', '3-66c01cdf99e84c83a9b3fe65b88db8c0', function(err, body) {
  if (!err)
    console.log(body);
});
```

### db.get(docname, [params], [callback])

gets `docname` from the database with optional query string
additions `params`.

``` js
alice.get('rabbit', { revs_info: true }, function(err, body) {
  if (!err)
    console.log(body);
});
```

### db.head(docname, [callback])

same as `get` but lightweight version that returns headers only.

``` js
alice.head('rabbit', function(err, _, headers) {
  if (!err)
    console.log(headers);
});
```

### db.copy(src_doc, dest_doc, opts, [callback])

`copy` the contents (and attachments) of a document
to a new document, or overwrite an existing target document

``` js
alice.copy('rabbit', 'rabbit2', { overwrite: true }, function(err, _, headers) {
  if (!err)
    console.log(headers);
});
```


### db.bulk(docs, [params], [callback])

bulk operations(update/delete/insert) on the database, refer to the 
[couchdb doc](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API).

### db.list([params], [callback])

list all the docs in the database with optional query string additions `params`.  

``` js
alice.list(function(err, body) {
  if (!err) {
    body.rows.forEach(function(doc) {
      console.log(doc);
    });
  }
});
```

### db.fetch(docnames, [params], [callback])

bulk fetch of the database documents, `docnames` are specified as per 
[couchdb doc](http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API).
additional query string `params` can be specified, `include_doc` is always set
to `true`.  

## attachments functions

### db.attachment.insert(docname, attname, att, contenttype, [params], [callback])

inserts an attachment `attname` to `docname`, in most cases
 `params.rev` is required. refer to the
 [doc](http://wiki.apache.org/couchdb/http_document_api) for more details.

``` js
var fs = require('fs');

fs.readFile('rabbit.png', function(err, data) {
  if (!err) {
    alice.attachment.insert('rabbit', 'rabbit.png', data, 'image/png',
      { rev: '12-150985a725ec88be471921a54ce91452' }, function(err, body) {
        if (!err)
          console.log(body);
    });
  }
});
```

or using `pipe`:

``` js
var fs = require('fs');

fs.createReadStream('rabbit.png').pipe(
    alice.attachment.insert('new', 'rab.png', null, 'image/png')
);
```

### db.attachment.get(docname, attname, [params], [callback])

get `docname`'s attachment `attname` with optional query string additions
`params`.  

``` js
var fs = require('fs');

alice.attachment.get('rabbit', 'rabbit.png', function(err, body) {
  if (!err) {
    fs.writeFile('rabbit.png', body);
  }
});
```

or using `pipe`:

``` js
var fs = require('fs');

alice.attachment.get('rabbit', 'rabbit.png').pipe(fs.createWriteStream('rabbit.png'));
```

### db.attachment.destroy(docname, attname, rev, [callback])

destroy attachment `attname` of `docname`'s revision `rev`.

``` js
alice.attachment.destroy('rabbit', 'rabbit.png',
    '1-4701d73a08ce5c2f2983bf7c9ffd3320', function(err, body) {
      if (!err)
        console.log(body);
});
```

## views and design functions

### db.view(designname, viewname, [params], [callback])

calls a view of the specified design with optional query string additions
`params`.  

``` js
alice.view('characters', 'crazy_ones', function(err, body) {
  if (!err) {
    body.rows.forEach(function(doc) {
      console.log(doc.value);
    });
  }
});
```

### db.show(designname, showname, docId, [params], [callback])

calls a show function of the specified design for the document specified by docId with 
optional query string additions `params`.  

``` js
alice.show('characters', 'formatDoc', '3621898430' function(err, doc) {
  if (!err) {
    console.log(doc);
  }
});
```
take a look at the [couchdb wiki](http://wiki.apache.org/couchdb/Formatting_with_Show_and_List#Showing_Documents)
for possible query paramaters and more information on show functions.

### db.atomic(designname, updatename, docname, [body], [callback])

calls the design's update function with the specified doc in input.

``` js
db.atomic("update", "inplace", "foobar", 
{field: "foo", value: "bar"}, function (error, response) {
  assert.equal(error, undefined, "failed to update");
  assert.equal(response.foo, "bar", "update worked");
});
```

check out the tests for a fully functioning example.

## using cookie authentication

nano supports making requests using couchdb's [cookie authentication](http://guide.couchdb.org/editions/1/en/security.html#cookies) functionality. there's a [step-by-step guide here](http://mahoney.eu/2012/05/23/couchdb-cookie-authentication-nodejs-nano/), but essentially you just:

``` js
var nano     = require('nano')('http://localhost:5984')
  , username = 'user'
  , userpass = 'pass'
  , callback = console.log // this would normally be some callback
  , cookies  = {} // store cookies, normally redis or something
  ;

nano.auth(username, userpass, function (err, body, headers) {
  if (err) { 
    return callback(err);
  }

  if (headers && headers['set-cookie']) {
    cookies[user] = headers['set-cookie'];
  }

  callback(null, "It worked");
});
```

reusing a cookie:

``` js
var auth = "some stored cookie"
  , callback = console.log // this would normally be some callback
  , alice = require('nano')(
    { url : 'http://localhost:5984/alice', cookie: 'AuthSession=' + auth });
  ;

alice.insert(doc, function (err, body, headers) {
  if (err) {
    return callback(err);
  }

  // change the cookie if couchdb tells us too
  if (headers && headers['set-cookie']) {
    auth = headers['set-cookie'];
  }

  callback(null, "It worked");
});
```

## advanced features

### extending nano

nano is minimalistic but you can add your own features with
`nano.request(opts, callback)`

for example, to create a function to retrieve a specific revision of the
`rabbit` document:

``` js
function getrabbitrev(rev, callback) {
  nano.request({ db: 'alice',
                 doc: 'rabbit',
                 method: 'get',
                 params: { rev: rev }
               }, callback);
}

getrabbitrev('4-2e6cdc4c7e26b745c2881a24e0eeece2', function(err, body) {
  if (!err) {
    console.log(body);
  }
});
```
### pipes

you can pipe in nano like in any other stream.  
for example if our `rabbit` document has an attachment with name `picture.png`
(with a picture of our white rabbit, of course!) you can pipe it to a `writable
stream`

``` js
var fs = require('fs'),
    nano = require('nano')('http://127.0.0.1:5984/');
var alice = nano.use('alice');
alice.attachment.get('rabbit', 'picture.png').pipe(fs.createWriteStream('/tmp/rabbit.png'));
```

then open `/tmp/rabbit.png` and you will see the rabbit picture.


## tutorials & screencasts

* screencast: [couchdb and nano](http://nodetuts.com/tutorials/30-couchdb-and-nano.html#video)
* article: [nano - a minimalistic couchdb client for nodejs](http://writings.nunojob.com/2011/08/nano-minimalistic-couchdb-client-for-nodejs.html)
* article: [getting started with node.js and couchdb](http://writings.nunojob.com/2011/09/getting-started-with-nodejs-and-couchdb.html)
* article: [document update handler support](http://jackhq.tumblr.com/post/16035106690/nano-v1-2-x-document-update-handler-support-v1-2-x)
* article: [nano 3](http://writings.nunojob.com/2012/05/Nano-3.html)
* article: [securing a site with couchdb cookie authentication using node.js and nano](http://mahoney.eu/2012/05/23/couchdb-cookie-authentication-nodejs-nano/)
* article: [adding copy to nano](http://blog.jlank.com/2012/07/04/adding-copy-to-nano/)
* article: [how to update a document with nano](http://writings.nunojob.com/2012/07/How-To-Update-A-Document-With-Nano-The-CouchDB-Client-for-Node.js.html)
* article: [thoughts on development using couchdb with node.js](http://tbranyen.com/post/thoughts-on-development-using-couchdb-with-nodejs)

## roadmap

check [issues][2]

## tests

to run (and configure) the test suite simply:

``` sh
cd nano
npm install
npm test
```

after adding a new test you can run it individually (with verbose output) using:

``` sh
nano_env=testing node tests/doc/list.js list_doc_params
```

where `list_doc_params` is the test name.

## contribute

everyone is welcome to contribute with patches, bug-fixes and new features

1. create an [issue][2] on github so the community can comment on your idea
2. fork `nano` in github
3. create a new branch `git checkout -b my_branch`
4. create tests for the changes you made
5. make sure you pass both existing and newly inserted tests
6. commit your changes
7. push to your branch `git push origin my_branch`
8. create a pull request

to run tests make sure you npm test but also run tests without mocks:

``` sh
npm run nock_off
```

check this [blogpost](http://writings.nunojob.com/2012/05/Mock-HTTP-Integration-Testing-in-Node.js-using-Nock-and-Specify.html) to learn more about how to write your own tests.

## meta

                    _
                  / _) roar! i'm a vegan!
           .-^^^-/ /
        __/       /
       /__.|_|-|_|     cannes est superb

* code: `git clone git://github.com/dscape/nano.git`
* home: <http://github.com/dscape/nano>
* bugs: <http://github.com/dscape/nano/issues>
* build: [![build status](https://secure.travis-ci.org/dscape/nano.png)](http://travis-ci.org/dscape/nano)

`(oo)--',-` in [caos][3]

[1]: http://npmjs.org
[2]: http://github.com/dscape/nano/issues
[3]: http://caos.di.uminho.pt/
[4]: https://github.com/dscape/nano/blob/master/cfg/couch.example.js
[follow]: https://github.com/iriscouch/follow
[request]:  https://github.com/mikeal/request

## license

copyright 2011 nuno job <nunojob.com> (oo)--',--

licensed under the apache license, version 2.0 (the "license");
you may not use this file except in compliance with the license.
you may obtain a copy of the license at

    http://www.apache.org/licenses/license-2.0

unless required by applicable law or agreed to in writing, software
distributed under the license is distributed on an "as is" basis,
without warranties or conditions of any kind, either express or implied.
see the license for the specific language governing permissions and
limitations under the license.
