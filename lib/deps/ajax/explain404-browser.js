'use strict';

// designed to give info to browser users, who are disturbed
// when they see 404s in the console
module.exports = function explain404(str) {
  if ('console' in global && 'info' in console) {
    console.info('The above 404 is totally normal. ' + str);
  }
};