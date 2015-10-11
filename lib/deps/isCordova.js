'use strict';

module.exports = function isCordova() {
  return (typeof cordova !== "undefined" ||
  typeof PhoneGap !== "undefined" ||
  typeof phonegap !== "undefined");
};