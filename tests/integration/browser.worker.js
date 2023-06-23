'use strict';

// only running in Chrome and Firefox due to various bugs.
// IE: https://connect.microsoft.com/IE/feedback/details/866495
// Safari: doesn't have IndexedDB or WebSQL in a WW
// NodeWebkit: not sure what the issue is

var isNodeWebkit = typeof window !== 'undefined' &&
  typeof process !== 'undefined';

if ((window && typeof window.Worker === 'function') &&
    !isNodeWebkit && !testUtils.isIE() &&
    ((window && window.chrome) || (navigator && /Firefox/.test(navigator.userAgent)))) {
  runTests();
}

function runTests() {
  describe('browser.worker.js', function () {
    it('will fail', function () {
      throw new Error('deliberate');
    });
  });
}
