if (typeof process === 'undefined' || process.browser) {
  // to avoid having to bundle anything, we just use a global window.testCases
// object and then run those
  window.testCases = [];
} else { // node
  global.testCases = [];
}