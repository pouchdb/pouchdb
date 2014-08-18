
'use strict';

(function(exports) {

  function hashChanged() {
    this.index = hashIndex();
    this.goTo(this.index);
  }

  function hashIndex() {
    return parseInt(document.location.hash.slice(1), 10) || 1;
  }

  function visit(index) {
    window.location.href = document.location.origin +
      document.location.pathname + '#' + index;
  }

  function Repl(wrapper, key) {
    this.index = 0;
    this.key = key;
    this.listeners = {};
    this.wrapper = document.getElementById(wrapper);
    this.max = document.querySelectorAll('.' + key).length;

    window.addEventListener('hashchange', hashChanged.bind(this));
  }

  Repl.prototype.next = function() {
    if (this.index < this.max) {
      visit(++this.index);
    }
  }

  Repl.prototype.back = function() {
    if (this.index > 1) {
      visit(--this.index);
    }
  }

  Repl.prototype.goTo = function(index) {
    var tpl = document.getElementById(this.key + '-' + this.index);
    if (tpl) {
      this.wrapper.innerHTML = tpl.innerHTML;
    }
    if (this.listeners.change) {
      this.listeners.change(this.index);
    }
  }

  Repl.prototype.canGoNext = function() {
    return this.index < this.max;
  }

  Repl.prototype.canGoBack = function() {
    return this.index > 1;
  }

  // I cant be bothered browserifying and all that, just
  // fake eventemitter
  Repl.prototype.on = function(event, fun) {
    this.listeners[event] = fun;
  }

  Repl.prototype.init = function() {
    hashChanged.call(this);
  }

  exports.Repl = Repl;

})(typeof module === 'undefined' ? window : module.exports);
