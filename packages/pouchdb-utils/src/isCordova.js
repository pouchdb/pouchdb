function isCordova() {
  return (typeof cordova !== "undefined" ||
  typeof PhoneGap !== "undefined" ||
  typeof phonegap !== "undefined");
}

export default isCordova;