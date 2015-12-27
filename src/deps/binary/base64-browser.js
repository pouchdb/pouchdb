'use strict';

var thisAtob = function (str) {
  return atob(str);
};

var thisBtoa = function (str) {
  return btoa(str);
};

export {
  atob as thisAtob,
  btoa as thisBtoa
}