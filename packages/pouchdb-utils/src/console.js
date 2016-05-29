function console(method) {
  if (console !== 'undefined' && method in console) {
    var args = Array.prototype.slice.call(arguments, 1);
    console[method].apply(null, args);
  }
}

export default console;
