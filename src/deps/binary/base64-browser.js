var thisAtob = function (str) {
  return atob(str);
};

var thisBtoa = function (str) {
  if (/[\u0080-\uFFFF]/.test(str)) {
    str = unescape(encodeURIComponent(str));
  }
  return btoa(str);
};

export {
  thisAtob as atob,
  thisBtoa as btoa
};