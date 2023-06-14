var thisAtob = function (str) {
  return atob(str);
};

var thisBtoa = function (str) {
  return btoa(str);
};

export { thisBtoa as a, thisAtob as t };
