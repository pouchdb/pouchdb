// Import PouchDB
var script = document.createElement('script');
script.src = 'http://127.0.0.1:8000/pouch.alpha.js';
document.body.appendChild(script);

var wrapper = document.createElement('div');
document.body.appendChild(wrapper);

var style = document.createElement('style');
style.innerHTML = '.conflict { color: red;  } ul { list-style-type: none; }';
document.body.appendChild(style);

// Init stuff
var DB_NAME = 'idb://glasgowjs';
var REMOTE_DB = 'http://127.0.0.1:2020/glasgowjs';

Pouch.destroy(DB_NAME);
Pouch.destroy(REMOTE_DB);

// Create a database
var local;
Pouch(DB_NAME, function(err, db) {
  console.log('made me a pouch');
  local = db;
});

// Put stuff in the database
local.put({
  _id: 'item_1',
  type: 'todo',
  text: 'Write a presentation',
  status: 'todo'
});

// List the stuff in the database
local.allDocs({include_docs: true}, function(err, docs) {
  console.log(docs.rows);
});

// Display the items
function displayRow(row) {

  var li = document.createElement('li');
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';

  li.appendChild(checkbox);
  li.appendChild(document.createTextNode(row.doc.text));

  if (row.doc._conflicts.length) {
    li.classList.add('conflict');
  }

  if (row.doc.status === 'done') {
    checkbox.setAttribute('checked', 'checked');
  }

  return li;
}

function displayDocs() {
  var ul = document.createElement('ul');
  local.allDocs({include_docs: true, conflicts: true}, function(err, docs) {
    docs.rows.forEach(function(doc) {
      ul.appendChild(displayRow(doc));
    });
  });
  wrapper.innerHTML = '';
  wrapper.appendChild(ul);
}

displayDocs();

// Make that a live view
var changes = local.changes({onChange: displayDocs, continuous: true});

local.put({
  _id: 'item_2',
  type: 'todo',
  text: 'Climb Mt Everest',
  status: 'todo'
});

// Replicate my local database to 'the cloud'
var push = local.replicate.to(REMOTE_DB, {continuous: true});

// Pull down changes from 'the cloud'
var pull = local.replicate.from(REMOTE_DB, {continuous: true});

local.put({
  _id: 'item_3',
  type: 'todo',
  text: 'Go to the moon',
  status: 'todo'
});

// Cancel the sync
push.cancel();
pull.cancel();

// Attempt to edit document without revision
local.put({
  _id: 'item_1',
  type: 'todo',
  text: 'Write a presentation',
  status: 'done'
}, function(err) {
  console.log(err);
});

// Edit the document
local.get('item_1', function(err, todo) {
  todo.status = 'done';
  local.put(todo, function(err) {
    if (!err) {
      console.log('edited!');
    }
  });
});

// TODO: Broken
local.get('item_1', {conflicts: true}, function(err, todo) {
  console.log(JSON.stringify(todo));
  local.get('item_1', {rev: todo._conflicts[0]}, function(err, conflict) {
    console.log(JSON.stringify(conflict));
  });
});