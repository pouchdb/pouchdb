"use strict";

/**
*
*  MD5 (Message-Digest Algorithm)
*
*  For original source see http://www.webtoolkit.info/
*  Download: 15.02.2009 from http://www.webtoolkit.info/javascript-md5.html
*
*  Licensed under CC-BY 2.0 License
*  (http://creativecommons.org/licenses/by/2.0/uk/)
*
**/
var crypto = require('crypto');

exports.MD5 = function (string) {
  if (!process.browser) {
    return crypto.createHash('md5').update(string).digest('hex');
  }
  function rotateLeft(lValue, iShiftBits) {
    return (lValue<<iShiftBits) | (lValue>>>(32 - iShiftBits));
  }

  function addUnsigned(lX, lY) {
    var lX4, lY4, lX8, lY8, lResult;
    lX8 = (lX & 0x80000000);
    lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000);
    lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) {
      return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    }
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      } else {
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
    } else {
      return (lResult ^ lX8 ^ lY8);
    }
  }

  function f(x, y, z) { return (x & y) | ((~x) & z); }
  function g(x, y, z) { return (x & z) | (y & (~z)); }
  function h(x, y, z) { return (x ^ y ^ z); }
  function i(x, y, z) { return (y ^ (x | (~z))); }

  function ff(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function gg(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function hh(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function ii(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWords_temp1 = lMessageLength + 8;
    var lNumberOfWords_temp2 =
      (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    var lWordArray = new Array(lNumberOfWords - 1);
    var lBytePosition = 0;
    var lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] |
                               (string.charCodeAt(lByteCount)<<lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength<<3;
    lWordArray[lNumberOfWords - 1] = lMessageLength>>>29;
    return lWordArray;
  }

  function wordToHex(lValue) {
    var   wordToHexValue = "",   wordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0;lCount <= 3;lCount++) {
      lByte = (lValue>>>(lCount * 8)) & 255;
      wordToHexValue_temp = "0" + lByte.toString(16);
      wordToHexValue = wordToHexValue +
                      wordToHexValue_temp.substr(
                        wordToHexValue_temp.length - 2, 2
                      );
    }
    return   wordToHexValue;
  }

  //**  function Utf8Encode(string) removed. Aready defined in pidcrypt_utils.js

  var x = [];
  var k, AA, BB, CC, DD, a, b, c, d;
  var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  var S21 = 5, S22 = 9,  S23 = 14, S24 = 20;
  var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  var S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  //  string = Utf8Encode(string); #function call removed

  x = convertToWordArray(string);

  a = 0x67452301;
  b = 0xEFCDAB89;
  c = 0x98BADCFE;
  d = 0x10325476;

  for (k = 0;k < x.length;k += 16) {
    AA = a;
    BB = b;
    CC = c;
    DD = d;
    a = ff(a, b, c, d, x[k + 0],  S11, 0xD76AA478);
    d = ff(d, a, b, c, x[k + 1],  S12, 0xE8C7B756);
    c = ff(c, d, a, b, x[k + 2],  S13, 0x242070DB);
    b = ff(b, c, d, a, x[k + 3],  S14, 0xC1BDCEEE);
    a = ff(a, b, c, d, x[k + 4],  S11, 0xF57C0FAF);
    d = ff(d, a, b, c, x[k + 5],  S12, 0x4787C62A);
    c = ff(c, d, a, b, x[k + 6],  S13, 0xA8304613);
    b = ff(b, c, d, a, x[k + 7],  S14, 0xFD469501);
    a = ff(a, b, c, d, x[k + 8],  S11, 0x698098D8);
    d = ff(d, a, b, c, x[k + 9],  S12, 0x8B44F7AF);
    c = ff(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = ff(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = ff(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = ff(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = ff(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = ff(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = gg(a, b, c, d, x[k + 1],  S21, 0xF61E2562);
    d = gg(d, a, b, c, x[k + 6],  S22, 0xC040B340);
    c = gg(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = gg(b, c, d, a, x[k + 0],  S24, 0xE9B6C7AA);
    a = gg(a, b, c, d, x[k + 5],  S21, 0xD62F105D);
    d = gg(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = gg(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = gg(b, c, d, a, x[k + 4],  S24, 0xE7D3FBC8);
    a = gg(a, b, c, d, x[k + 9],  S21, 0x21E1CDE6);
    d = gg(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = gg(c, d, a, b, x[k + 3],  S23, 0xF4D50D87);
    b = gg(b, c, d, a, x[k + 8],  S24, 0x455A14ED);
    a = gg(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = gg(d, a, b, c, x[k + 2],  S22, 0xFCEFA3F8);
    c = gg(c, d, a, b, x[k + 7],  S23, 0x676F02D9);
    b = gg(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = hh(a, b, c, d, x[k + 5],  S31, 0xFFFA3942);
    d = hh(d, a, b, c, x[k + 8],  S32, 0x8771F681);
    c = hh(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = hh(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = hh(a, b, c, d, x[k + 1],  S31, 0xA4BEEA44);
    d = hh(d, a, b, c, x[k + 4],  S32, 0x4BDECFA9);
    c = hh(c, d, a, b, x[k + 7],  S33, 0xF6BB4B60);
    b = hh(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = hh(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = hh(d, a, b, c, x[k + 0],  S32, 0xEAA127FA);
    c = hh(c, d, a, b, x[k + 3],  S33, 0xD4EF3085);
    b = hh(b, c, d, a, x[k + 6],  S34, 0x4881D05);
    a = hh(a, b, c, d, x[k + 9],  S31, 0xD9D4D039);
    d = hh(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = hh(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = hh(b, c, d, a, x[k + 2],  S34, 0xC4AC5665);
    a = ii(a, b, c, d, x[k + 0],  S41, 0xF4292244);
    d = ii(d, a, b, c, x[k + 7],  S42, 0x432AFF97);
    c = ii(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = ii(b, c, d, a, x[k + 5],  S44, 0xFC93A039);
    a = ii(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = ii(d, a, b, c, x[k + 3],  S42, 0x8F0CCC92);
    c = ii(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = ii(b, c, d, a, x[k + 1],  S44, 0x85845DD1);
    a = ii(a, b, c, d, x[k + 8],  S41, 0x6FA87E4F);
    d = ii(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = ii(c, d, a, b, x[k + 6],  S43, 0xA3014314);
    b = ii(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = ii(a, b, c, d, x[k + 4],  S41, 0xF7537E82);
    d = ii(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = ii(c, d, a, b, x[k + 2],  S43, 0x2AD7D2BB);
    b = ii(b, c, d, a, x[k + 9],  S44, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  var temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
  return temp.toLowerCase();
};
