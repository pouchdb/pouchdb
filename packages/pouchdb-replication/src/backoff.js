var STARTING_BACK_OFF = 0;

import { defaultBackOff } from 'pouchdb-utils';

function backOff(opts, returnValue, error, callback) {
  if (opts.retry === false) {
    returnValue.emit('error', error);
    returnValue.removeAllListeners();
    return;
  }
  if (typeof opts.back_off_function !== 'function') {
    opts.back_off_function = defaultBackOff;
  }
  returnValue.emit('requestError', error);
  if (returnValue.state === 'active' || returnValue.state === 'pending') {
    returnValue.emit('paused', error);
    returnValue.state = 'stopped';
    function backoffTimeSet() {
      opts.current_back_off = STARTING_BACK_OFF;
    }
    function removeBackOffTimeSet() {
      returnValue.removeListener('active', backoffTimeSet);
    }
    returnValue.once('paused', removeBackOffTimeSet);
    returnValue.once('active', backoffTimeSet);
  }

  opts.current_back_off = opts.current_back_off || STARTING_BACK_OFF;
  opts.current_back_off = opts.back_off_function(opts.current_back_off);
  setTimeout(callback, opts.current_back_off);
}

export default backOff;
