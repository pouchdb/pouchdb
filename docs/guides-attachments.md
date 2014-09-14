---
layout: 2ColLeft
title: Working with attachments
sidebar: guides_nav.html
---

Attachments are where PouchDB can get really fun.

The big difference between storage engines like WebSQL/IndexedDB and the older localStorage API is that you can stuff a lot more data in it than you're used to. Attachments allow you to use that to full advantage to store images, zip files, or whatever you want.

How attachments are stored
----------

As their name implies, attachments are *attached* to documents. You can work with attachments either in base64-encoded format, or as a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

For instance, let's put a document with a small icon attachment, represented as a base64-encoded string. Then we'll fetch it and display the icon:

```
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

You can see **[a live example](http://bl.ocks.org/nolanlawson/2a5f98a66c9fe3ae3532) of this code.

No doubt you will be unsurprised to see a cat icon smiling back at you. If the kitten theme bothers you, then you haven't been on the Internet very long.