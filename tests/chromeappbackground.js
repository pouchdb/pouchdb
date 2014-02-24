/*globals chrome */
'use strict';
chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create('./test.html', {
    'width': 1000,
    'height': 800
  });
});