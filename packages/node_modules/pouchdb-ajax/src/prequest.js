import ajaxCore from './ajaxCore';

function ajax(opts, callback) {
  // do nothing; all the action is in prerequest-browser.js
  return ajaxCore(opts, callback);
}

export default ajax;