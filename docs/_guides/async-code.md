---
index: 6
layout: guide
title: Asynchronous code
sidebar: guides_nav.html
---

PouchDB provides a fully **asynchronous** API. This ensures that when you talk to PouchDB, the UI doesn't stutter, because the DOM is not being blocked by database operations.

However, working with asynchronous code can be very complex, especially if you're only accustomed to synchronous APIs. So it's worth going over some of the basics.

I promise to call you back...
------

To make things as flexible as possible for PouchDB users, the API is provided in both **callback** format and **promise** format.

The **callback** format looks like this:

```js
db.get('mittens', function (error, doc) {
  if (error) {
    // oh noes! we got an error
  } else {
    // okay, doc contains our document
  }
});
```

The **promise** format looks like this:

```js
db.get('mittens').then(function (doc) {
  // okay, doc contains our document
}).catch(function (err) {
  // oh noes! we got an error
});
```

Basically, if you include a callback as the last argument in a function, then PouchDB assumes you want the callback style. Otherwise it assumes you want the promise style.

Let's talk about promises
-------

For this guide, we will use the **promise** format for a few reasons:

1. Callbacks easily lead to spaghetti code, or to the [pyramid of doom](https://medium.com/@wavded/managing-node-js-callback-hell-1fe03ba8baf).
2. Promises generally lead to better code organization, although they do have a steep learning curve.

If you already understand promises, you can [skip to the next section](updating-deleting.html).

Understanding promises
---------

If you have the time, you are strongly encouraged to watch [this 50-minute video: "Redemption from Callback Hell"](http://youtu.be/hf1T_AONQJU). The rest of this chapter basically summarizes that video.

The best way to think of promises is that they bring keywords like `return` and `try/catch` to asynchronous code.

Synchronous code:

```js
function returnSomething() {
  try {
    doSomething();
    doSomethingElse();
    return true;
  } catch (err) {
    console.log(err);
  }
}
```

Asynchronous code:

```js
function returnSomething() {
  return doSomething().then(function () {
    return doSomethingElse();
  }).then(function () {
    return true;
  }).catch(function (err) {
    console.log(err);
  });
}
```

Use `catch()` to catch errors
--------

The big advantage of working with Promises in asynchronous code is that you can always attach a `catch` function to the end of a big promise chain, and any errors that occur along the way will show up at the end.

This avoids endless `if (err) {}` checking in the callback world:

```js
doSomething(function (err, result) {
  if (err) {
    // handle error
  }
  doSomethingElse(function (err, result) {
    if (err) {
      // handle error again...
    }
    doSomethingYetAgain(function (err, result) {
      if (err) {
        // seriously? okay, handle error again...
      }
    });
  });
});
```

Instead, in the promise world, you can have a long chain of asynchronous operations with a single `catch` at the end. To use PouchDB as an example:

```js
db.put({_id: 'charlie', age: 21}).then(function () {
  return db.get('charlie');
}).then(function (charlie) {
  // increment Charlie's age
  charlie.age++;
  return db.put(charlie);
}).then(function () {
  return db.get('charlie');
}).then(function (charlie) {
  // increment Charlie's age again
  charlie.age++;
  return db.put(charlie);
}).then(function () {
  return db.get('charlie');
}).then(function (charlie) {
  console.log(charlie);
}).catch(function (err) {
  console.log(err);
});
```

You should see:

```js
{"age":23,"_id":"charlie","_rev":"3-e794618b4e39ed566cc68b56f5426e8e"}
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/612f95cbbb69eaafc2d5)** of this code.

In this example, we put/get a document 3 times in a row. At the very end, there is a `catch()` statement to catch any errors along the way.

What kind of errors might we run into? Well, let's imagine that we accidentally misspell the id `'charlie'` at some point. In this case, we will gracefully catch the error.  Here's another **[live example](http://bl.ocks.org/nolanlawson/0f1c815cb5fe74cff5fc)**.

You should see:

```js
{"status":404,"name":"not_found","message":"missing"}
```

This is really nice! No matter where the misspelling is, the error can be handled within a single function. That's much nicer than having to do `if (err){}` an endless number of times!

An alternate way of catching errors
-------

If you've been doing promises for awhile, you might have seen this instead:

```js
db.get('charlie').then(function (charlie) {
  // we got the charlie doc
}, function (err) {
  // we got an error
})
``` 

This is equivalent to:

```js
db.get('charlie').then(function (charlie) {
  // we got the charlie doc
}).catch(function (err) {
  // we got an error
})
``` 

The `catch()` method is just syntactic sugar. You can use either format.

Promises 101
------

The `then()` method takes a function. What can you do within this function? Three things:

* Return another promise
* Throw an error
* Return a non-promise object (or `undefined`)

Another way to think of it is this:

```js
db.get('charlie').then(function (charlie) {
  // Within this function, you can do
  // try/catch/return like you normally would,
  // and it will be handled asynchronously!
}).then(function (result) {
  // If the previous function returned something
  // (or returned undefined), it will show up here 
  // as "result".
}).catch(function (err) {
  // If the previous function threw an error,
  // it will show up here as "err".
});
```

Promises in PouchDB
-------

Promises are supported natively in [some browsers](http://caniuse.com/#feat=promises). But since they're not universally supported, PouchDB uses [lie](https://github.com/calvinmetcalf/lie) in browsers that don't support them. In Node.js PouchDB uses [bluebird](https://github.com/petkaantonov/bluebird).

You are free to integrate any Promise library you like with PouchDB, as long as it is compliant with [the Promises A+ spec](http://promisesaplus.com/). Some libraries that fit the bill:

<ul>
<li><a href="https://github.com/petkaantonov/bluebird">bluebird</a></li>
<li><a href="https://github.com/calvinmetcalf/lie">lie</a></li>
<li><a href="https://github.com/kriskowal/q">Q</a></li>
<li><a href="https://github.com/tildeio/rsvp.js">RSVP</a></li>
<li><a href="https://github.com/then/promise">then/promise</a></li>
<li><a href="https://github.com/cujojs/when">when</a></li>
</ul>

If you use one of these libraries, then you will have access to some advanced Promise features. Read that library's documentation for details.

Next
------

Now that you have a grasp on promises, let's learn about updating and deleting documents.