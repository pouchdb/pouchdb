'use strict';

import ajax from './ajaxCore';

export default  function(opts, callback) {
  // do nothing; all the action is in prerequest-browser.js
  return ajax(opts, callback);
};
