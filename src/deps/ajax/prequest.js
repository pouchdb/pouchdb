'use strict';

import ajax from './ajaxCore';

function prequest(opts, callback) {
  // do nothing; all the action is in prerequest-browser.js
  return ajax(opts, callback);
}

export default prequest;