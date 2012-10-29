var verbose = (process.env.NANO_ENV==='testing')
  , logger  = exports
  ;

module.exports = function logging(cfg) {
  var logStrategy = cfg ? cfg.log : undefined;
  if (typeof logStrategy !== 'function') {
    if(verbose) {
      logStrategy = function consoleLog(eventId, args) { 
        console.log(eventId, args);
      }; 
    }
    else logStrategy = function noop(){};
  }

  return function logEvent(prefix) {
    var eventId = 
      (prefix ? prefix + '-' : '') + (~~(Math.random() * 1e9)).toString(36);
    return function log() {
      logStrategy.call(this, eventId, [].slice.call(arguments,0));
    };
  };
};