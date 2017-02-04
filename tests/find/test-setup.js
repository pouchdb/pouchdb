// to avoid having to bundle anything, we just use a global window.testCases
// object and then run those

'use strict';

if (typeof process === 'undefined' || process.browser) {
  window.testCases = [];
} else { // node
  global.testCases = [];
}