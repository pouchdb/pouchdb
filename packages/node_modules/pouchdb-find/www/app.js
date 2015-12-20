(function ($) {
  'use strict';

  // set up editor
  var snippets = [
    "// The _id field is the primary index. This query finds\n// all documents with _id greater than or equal to \"dk\"\ndb.find({\n  selector: {_id: {$gte: 'dk'}},\n  sort: ['_id']\n});",
    "// For other fields, you must create an index first.\n// This query sorts all documents by name.\ndb.createIndex({\n  index: {fields: ['name']}\n}).then(function () {\n  return db.find({\n    selector: {name: {$gt: null}},\n    sort: ['name']\n  });\n});",
    "// Available selectors are $gt, $gte, $lt, $lte, \n// $eq, $ne, $exists, $type, and more\ndb.createIndex({\n  index: {fields: ['debut']}\n}).then(function () {\n  return db.find({\n    selector: {debut: {$gte: 1990}}\n  });\n});",
    "// Multi-field queries and sorting are also supported\ndb.createIndex({\n  index: {fields: ['series', 'debut']}\n}).then(function () {\n  return db.find({\n    selector: {series: {$eq: 'Mario'}},\n    sort: [{series: 'desc'}, {debut: 'desc'}]\n  });\n});",
    "// You can also select certain fields.\n// Change this code to try it yourself!\ndb.createIndex({\n  index: {fields: ['debut']}\n}).then(function () {\n  return db.find({\n    selector: {debut: {$gt: null}},\n    fields: ['_id', 'debut'],\n    sort: ['debut']\n  });\n});"
  ];

  var editor = ace.edit("editor");
  editor.setValue(snippets[0]);
  editor.setTheme("ace/theme/xcode");
  var session = editor.getSession();
  session.setMode("ace/mode/javascript");
  session.setTabSize(2);
  var editorDiv = $('#editor');
  editorDiv.addClass('shown');

  // set up pouch
  var template = Handlebars.compile($("#smashers-template").html());
  var listDiv = $('#smashers');
  var rawDiv = $('#smashers-raw');

  function updateList(res) {
    rawDiv.empty().append(JSON.stringify(res, undefined, 2)).addClass('shown');
    listDiv.empty().append(template({smashers: res.docs})).addClass('shown');
  }

  function showError(err) {
    rawDiv.empty();
    listDiv.empty().append($('<pre/>').append(err.stack)).addClass('shown');
  }

  var smashers = [
    { name: 'Mario', _id: 'mario', series: 'Mario', debut: 1981 },
    { name: 'Jigglypuff', _id: 'puff', series: 'Pokemon', debut: 1996 },
    { name: 'Link', _id: 'link', series: 'Zelda', debut: 1986 },
    { name: 'Donkey Kong', _id: 'dk', series: 'Mario', debut: 1981 },
    { name: 'Pikachu', series: 'Pokemon', _id: 'pikachu', debut: 1996 },
    { name: 'Captain Falcon', _id: 'falcon', series: 'F-Zero', debut: 1990 },
    { name: 'Luigi', _id: 'luigi', series: 'Mario', debut: 1983 },
    { name: 'Fox', _id: 'fox', series: 'Star Fox', debut: 1993 },
    { name: 'Ness', _id: 'ness', series: 'Earthbound', debut: 1994 },
    { name: 'Samus', _id: 'samus', series: 'Metroid', debut: 1986 },
    { name: 'Yoshi', _id: 'yoshi', series: 'Mario', debut: 1990 },
    { name: 'Kirby', _id: 'kirby', series: 'Kirby', debut: 1992 }
  ];
  var db = new PouchDB('smashers');
  db.info().then(function (info) {
    if (info.update_seq === 0) {
      return db.bulkDocs(smashers); // initial DB
    }
  }).then(function () {
    return eval(snippets[0]);
  }).then(updateList);

  // set up buttons
  $('.sortable').each(function (i, btn) {
    $(btn).click(function () {
      editor.setValue(snippets[i]);
      $('.sortable').each(function (j, otherBtn) {
        $(otherBtn).toggleClass('btn-selected', i === j);
      });
    });
  });

  // set up "Run code"

  $('.run-code').click(function () {
    listDiv.removeClass('shown');
    rawDiv.removeClass('shown');
    setTimeout(function () {
      var promise = eval(editor.getValue());
      promise.then(updateList).catch(showError);
    }, 200);
  });

})(jQuery);