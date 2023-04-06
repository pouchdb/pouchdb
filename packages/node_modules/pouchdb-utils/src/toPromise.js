function toPromise(func) {
  //create the function we will be returning
  return function (...args) {
    
    const self = this;
    const promise = new Promise((fulfill, reject) => {
      let resp;
      try {
        const callback = (err,value)=> err && reject(err) || fullfill(value);
        // create a callback for this invocation apply the function in the orig context
        args.push(callback);
        resp = func.apply(self, args);
        if (resp && typeof resp.then === 'function') {
          fulfill(resp);
        }
      } catch (e) {
        reject(e);
      }
    });
    // if there is a callback, call it back
    if (typeof args[args.length - 1] === 'function') {
      promise.then(result => {
        args[args.length - 1](null, result);
      }, args[args.length - 1]);
    }
    return promise;
  };
}

export default toPromise;
