---
index: 9
layout: guide
title: Working with attachments
sidebar: guides_nav.html
---

Attachments are where PouchDB can get really fun.

The big difference between storage engines like WebSQL/IndexedDB and the older localStorage API is that you can stuff [a lot more data](http://www.html5rocks.com/en/tutorials/offline/quota-research/) in it.

PouchDB attachments allow you to use that to full advantage to store images, MP3s, zip files, or whatever you want.

How attachments are stored
----------

As their name implies, attachments are *attached* to documents. You can work with attachments either in base64-encoded format, or as a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

For example, here is a very simple document with a plain text attachment, stored as base64.

```js
db.put({
  _id: 'mydoc',
  _attachments: {
    'myattachment.txt': {
      content_type: 'text/plain',
      data: 'aGVsbG8gd29ybGQ='
    }
  }
});
```

Our document has the usual `_id` field, but it also has a special `_attachments` field that holds the attachments. Documents can have as many attachments as you want.

{% include alert/start.html variant="info" %}

When you create an attachment, you need to specify its <code>content_type</code>, otherwise known as the <a href='https://en.wikipedia.org/wiki/MIME'>MIME type</a>. Common MIME types include <code>'text/plain'</code> for plain text, <code>'image/png'</code> for PNG images, and <code>'image/jpeg'</code> for JPG images.

{% include alert/end.html %}

As it turns out, `'aGVsbG8gd29ybGQ='` is just the string `'hello world'` encoded in base64. You can use the `atob()` and `btoa()` methods in your browser to verify.

```js
btoa('hello world')      // "aGVsbG8gd29ybGQ="
atob('aGVsbG8gd29ybGQ=') // "hello world"
```

Let's see what happens after we store this document. If you try to `get()` it normally, you may be surprised to see that the attachment data itself isn't returned:

```js
db.get('mydoc').then(function (doc) {
  console.log(doc);
});
```

The returned document will look like this:

```js
{
  "_attachments": {
    "myattachment.txt": {
      "content_type": "text/plain",
      "digest": "md5-XrY7u+Ae7tCTyyK7j1rNww==",
      "stub": true
    }
  },
  "_id": "mydoc",
  "_rev": "1-e8a84187bb4e671f27ec11bdf7320aaa"
}
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/0a4b1267d3a5b5edd7b1)** of this code.

By default, PouchDB will only give you an attachment **stub**, which contains a `digest`, i.e. the [md5sum](http://en.wikipedia.org/wiki/Md5sum) of the binary attachment.

To get the full attachments when using `get()` or `allDocs()`, you need to specify `{attachments: true}`:

```js
db.get('mydoc', {attachments: true}).then(function (doc) {
  console.log(doc);
});
```

Then you'll get back the full attachment, base64-encoded:

```js
{
  "_attachments": {
    "myattachment.txt": {
      "content_type": "text/plain",
      "digest": "md5-XrY7u+Ae7tCTyyK7j1rNww==",
      "data": "aGVsbG8gd29ybGQ="
    }
  },
  "_id": "mydoc",
  "_rev": "1-e8a84187bb4e671f27ec11bdf7320aaa"
}
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/b6d6164035f1fa0d38a8)** of this code.

Image attachments
--------

Plaintext is cool and all, but you know what would be *really* awesome? Storing images.

So let's do it! In this example, we'll put a document with a small icon attachment, represented as a base64-encoded string. Then we'll fetch it and display the icon as a normal `<img>` tag:

```js
db.put({
  _id: 'meowth', 
  _attachments: {
    'meowth.png': {
      content_type: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAACgAAAAkCAIAAAB0Xu9BAAAABGdBTUEAALGPC/xhBQAAAuNJREFUWEetmD1WHDEQhDdxRMYlnBFyBIccgdQhKVcgJeQMpE5JSTd2uqnvIGpVUqmm9TPrffD0eLMzUn+qVnXPwiFd/PP6eLh47v7EaazbmxsOxjhTT88z9hV7GoNF1cUCvN7TTPv/gf/+uQPm862MWTL6fff4HfDx4S79/oVAlAUwqOmYR0rnazuFnhfOy/ErMKkcBFOr1vOjUi2MFn4nuMil6OPh5eGANLhW3y6u3aH7ijEDCxgCvzFmimvc95TekZLyMSeJC68Bkw0kqUy1K87FlpGZqsGFCyqEtQNDdFUtFctTiuhnPKNysid/WFEFLE2O102XJdEE+8IgeuGsjeJyGHm/xHvQ3JtKVsGGp85g9rK6xMHtvHO9+WACYjk5vkVM6XQ6OZubCJvTfPicYPeHO2AKFl5NuF5UK1VDUbeLxh2BcRGKTQE3irHm3+vPj6cfCod50Eqv5QxtwBQUGhZhbrGVuRia1B4MNp6edwBxld2sl1splfHCwfsvCZfrCQyWmX10djjOlWJSSy3VQlS6LmfrgNvaieRWx1LZ6s9co+P0DLsy3OdLU3lWRclQsVcHJBcUQ0k9/WVVrmpRzYQzpgAdQcAXxZzUnFX3proannrYH+Vq6KkLi+UkarH09mC8YPr2RMWOlEqFkQClsykGEv7CqCUbXcG8+SaGvJ4a8d4y6epND+pEhxoN0vWUu5ntXlFb5/JT7JfJJqoTdy9u9qc7ax3xJRHqJLADWEl23cFWl4K9fvoaCJ2BHpmJ3s3z+O0U/DmzdMjB9alWZtg4e3yxzPa7lUR7nkvxLHO9+tvJX3mtSDpwX8GajB283I8R8a7D2MhUZr1iNWdny256yYLd52DwRYBtRMvE7rsmtxIUE+zLKQCDO4jlxB6CZ8M17GhuY+XTE8vNhQiIiSE82ZsGwk1pht4ZSpT0YVpon6EvevOXXH8JxVR78QzNuamupW/7UB7wO/+7sG5V4ekXb4cL5Lyv+4IAAAAASUVORK5CYII='
    }
  }
}).then(function () {
  return db.getAttachment('meowth', 'meowth.png');
}).then(function (blob) {
  var url = URL.createObjectURL(blob);
  var img = document.createElement('img');
  img.src = url;
  document.body.appendChild(img);
}).catch(function (err) {
  console.log(err);
});
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/2a5f98a66c9fe3ae3532)** of this code.

You should be unsurprised to see a cat smiling back at you. If the kitten theme bothers you, then you haven't been on the Internet very long.

How does this code work? First off, we are making use of the `URL.createObjectURL()` method, which is a standard HTML5 method that converts a `Blob` to a URL that we can easily use as the `src` of an `img`.

Second off, we are using the `getAttachment()` API, which returns a `Blob` rather than a base64-encoded string. To be clear: we can always convert between base64 and `Blob`s, but in this case, `getAttachment()` is just more convenient.


Image attachments using the File/Blob API
------------
You can also upload a File with the HTML5 `File` API and store it directly in the DB, because the data you get from the `<input type='file'>` element is already a `Blob`.
See: [Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [File API](https://developer.mozilla.org/en-US/docs/Web/API/File), which inherits properties from the `Blob` Interface.

```js
var inputFile = document.querySelector('#inputFile');
var imageMetaData = document.querySelector('#img_meta_data');
var uploadedFile = {};

function fileUpload() {
    var getFile = inputFile.files[0];
    uploadedFile = {
        file: getFile,
        size: getFile.size,
        type: getFile.type,
        name: getFile.name
    };


    new PouchDB('sample').destroy().then(function () {
      return new PouchDB('sample');
    }).then(function (db) {
      //
      // IMPORTANT CODE STARTS HERE
      //
      db.put({
        _id: 'image', 
        _attachments: {
          "file": {
            size: uploadedFile.size,
            type: uploadedFile.type,
            data: uploadedFile.file
          }
        }
      }).then(function () {
        return db.getAttachment('image', 'file');
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var img = document.createElement('img');
        img.src = url;
        document.body.appendChild(img);
        imageMetaData.innerText = 'Filesize: ' + JSON.stringify(Math.floor(blob.size/1024)) + 'KB, Content-Type: ' + JSON.stringify(blob.type);
      }).catch(function (err) {
        console.log(err);
      });
      //
      // IMPORTANT CODE ENDS HERE
      //
    });
}

// wait for change, then call the function
inputFile.addEventListener('change', fileUpload, false);
```
You can see **[a live example](https://jsbin.com/xerofo/edit?js,output)** of this code.
Select a file, upload it and you will see the stored file, `size` and the `type` which are valid `Blob` properties.

Directly storing binary data
-------------

Up to now, we've been supplying our attachments as base64-encoded strings. But we can also create the Blobs ourselves and store those directly in PouchDB.

Another shortcut we can use is the `putAttachment()` API, which simply modifies the existing document to hold a new attachment. Or, if the document does not exist, it will create an empty one.

{% include alert/start.html variant="info" %}

In <strong>Node.js</strong>, PouchDB uses <a href='http://nodejs.org/api/buffer.html'>Buffers</a> instead of Blobs. Otherwise, the same rules apply.

{% include alert/end.html %}

For instance, we can read the image data from an `<img>` tag using a `canvas` element, and then directly write that Blob to PouchDB:

```js
function convertImgToBlob(img, callback) {
   var canvas = document.createElement('canvas');
   var context = canvas.getContext('2d');
   context.drawImage(img, 0, 0);
   
    // Warning: toBlob() isn't supported by every browser.
    // You may want to use blob-util.
   canvas.toBlob(callback, 'image/png');
}

var catImage = document.getElementById('cat');
convertImgToBlob(catImage, function (blob) {
  db.putAttachment('meowth', 'meowth.png', blob, 'image/png').then(function () {
    return db.get('meowth', {attachments: true});
  }).then(function (doc) {
    console.log(doc);
  });
});
```

You can see **[a live example](http://bl.ocks.org/nolanlawson/edaf09b84185418a55d9)** of this code.

This stores exactly the same image content as in the other example, which you can confirm by checking the base64-encoded output.

{% include alert/start.html variant="warning" %}

Blobs can be tricky to work with, especially when it comes to cross-browser support.
You may find <a href='https://github.com/nolanlawson/blob-util'>blob-util</a> to be a useful
addition to the attachment API. For instance, it has an
<code>imgSrcToBlob()</code> method that will work cross-browser.

{% include alert/end.html %}

Base64 vs Blobs/Buffers
-------

Whether you supply attachments as base64-encoded strings or as Blobs/Buffers, PouchDB will try to store them in [the most efficient way](/faq.html#data_types). 

So when you insert your attachments, either format is acceptable. For instance, you can put Blobs/Buffers using `put()`:

```js
db.put({
  _id: 'mydoc',
  _attachments: {
    'myattachment.txt': {
      content_type: 'text/plain',
      data: myBlob
    }
  }
});
```

And you can also pass base64-encoded strings to `putAttachment()`:

```js
db.putAttachment('mydoc', 'myattachment.png', myBase64String, 'image/png');
```

You can also insert multiple attachments at once using `put()`:

```js
db.put({
  _id: 'mydoc',
  _attachments: {
    'myattachment1.txt': {
      content_type: 'text/plain',
      data: myBlob1
    },
    'myattachment2.txt': {
      content_type: 'text/plain',
      data: myBlob2
    },
    'myattachment3.txt': {
      content_type: 'text/plain',
      data: myBlob3
    },
    // etc.
  }
});
```

The `bulkDocs()` and `post()` APIs also accept attachments in either format.

When you fetch attachments, however, `getAttachment()` will always return Blobs/Buffers.

The other "read" APIs, such as `get()`, `allDocs()`, `changes()`, and `query()` have an `{attachments: true}` option that returns the attachments base64-encoded strings. If you add `{binary: true}`, though, they will return Blobs/Buffers.

Blob types
----

Blobs have their own `type`, but there is also a `content_type` that you specify when you store it in PouchDB:

```js
var myBlob = new Blob(['I am plain text!'], {type: 'text/plain'});
console.log(myBlob.type); // 'text/plain'

db.put({
  _id: 'mydoc',
  _attachments: {
    'myattachment.txt': {
      content_type: 'text/plain',
      data: myBlob
    }
  }
});
```

The reason for this redundancy is 1) Buffers in Node do not have a `type`, and 2) the CouchDB attachment format requires it.

So for best results, you should ensure that your Blobs have the same type as the one reported to PouchDB. Otherwise you may see inconsistent behavior (e.g. in IndexedDB, where the Blob is stored as-is on compatible browsers).

Related API documentation
--------

* [putAttachment()](/api.html#save_attachment)
* [getAttachment()](/api.html#get_attachment)
* [removeAttachment()](/api.html#delete_attachment)

Next
----

Now that you can attach cat pictures to all your documents (and why wouldn't you?), let's talk about replication.
