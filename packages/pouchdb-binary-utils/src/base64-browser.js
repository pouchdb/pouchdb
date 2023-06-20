var thisAtob = function (str) {
  return atob(str);
};

var thisBtoa = function (str) {
  return btoa(str);
};

export {
  thisAtob as atob,
  thisBtoa as btoa
};