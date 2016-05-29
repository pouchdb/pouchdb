function console(method, ...args) {
  if (console !== 'undefined' && method in console) {
    console[method].apply(null, args);
  }
}

export default console;
