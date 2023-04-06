// TODO: Search for all users of adapterFun and translate to stream as this is a queue implementation
// Returns a function that depends some how on this.taskqueue maybe something implemented some where else?
const adapterFun = (name, callback) =>
async function (...args) {
  (this._closed || this._destroyed) && new Error(`database is  ${this._destroyed && 'destroyed' || 'closed'}`);

    /* istanbul ignore if */ // Patches last arrgument of args
    if (this.constructor.listeners('debug').length) {
      const logArgs = ['api', self.name, name].concat(args);
      this.constructor.emit('debug', logArgs);
      const origCallback = args.slice(-1);
      args[args.length - 1] = (err, res) => {
        const responseArgs = ['api', self.name, name].concat(
          err ? ['error', err] : ['success', res]
        );
        this.constructor.emit('debug', responseArgs);
        origCallback(err, res);
      };
    }

  return !this.taskqueue.isReady ? new Promise((fulfill, reject) => 
      this.taskqueue.addTask((failed) => 
        (failed) ? reject(failed) : fulfill(self[name](...args))
      )
    ) : callback.apply(this, args);
};

export default adapterFun;
