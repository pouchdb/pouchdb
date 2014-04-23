'use strict';

var repl = new Repl('tutorial-wrapper', 'repl');
var replBack = document.getElementById('repl-back');
var replNext = document.getElementById('repl-next');

function setAttribute(dom, key, val) {
  if (val) {
    dom.setAttribute(key, val);
  } else {
    dom.removeAttribute(key);
  }
}

repl.on('change', function(i) {
  setAttribute(replBack, 'href', repl.canGoBack() ? '#' + (i-1) : false);
  setAttribute(replNext, 'href', repl.canGoNext() ? '#' + (i+1) : false);
});

// probably ambitious, can just use next() / back()
window.__defineGetter__('next', repl.next.bind(repl));
window.__defineGetter__('back', repl.back.bind(repl));

var listeners = {};
PouchDB.on('created', function(name) {
  if (name in listeners) return;
  console.log('=> CREATED', name);
  listeners[name] = new PouchDB(name);
  listeners[name].on('change', function(change) {
    console.log('=> UPDATED', change);
  });
})

repl.init();

