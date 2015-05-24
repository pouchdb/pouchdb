'use strict';

var utils = require('../../lib/utils');
var base64ToBinary = utils.atob;
var parseMultipart = require('../../lib/deps/parse-multipart');

describe('test.multipart.js', function () {

  it('basic multipart decoding', function () {
    var base64 =
      "LS1lNTA1Njg3MzRlMzU2OTk3ZDIyOTU5NTkzNjA3YjgzOA0KQ29udGVudC1UeXBlOiBtdW" +
      "x0aXBhcnQvcmVsYXRlZDsgYm91bmRhcnk9ImMyZGMyYWVmYTQwMTYyZGYwYmNmMDlhYTY1" +
      "ZjdmNjE5Ig0KDQotLWMyZGMyYWVmYTQwMTYyZGYwYmNmMDlhYTY1ZjdmNjE5DQpDb250ZW" +
      "50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb24NCg0KeyJfaWQiOiJiaW5fZG9jIiwiX3JldiI6" +
      "IjMtN2NjM2FjYzk3MTA3OTQ4ZTAyYjAwNjFkNGQzMjMzYTkiLCJfcmV2aXNpb25zIjp7In" +
      "N0YXJ0IjozLCJpZHMiOlsiN2NjM2FjYzk3MTA3OTQ4ZTAyYjAwNjFkNGQzMjMzYTkiLCI0" +
      "YzMzZmRiZWZlNTI4Mjk4ZGQyZjM3YjNlMmE4YWIyNSIsIjUwN2NhNjFmZjM2Y2UxMDQ5Nz" +
      "QwNzQ4YTg3Y2M1N2ExIl19LCJfYXR0YWNobWVudHMiOnsiZm9vLnR4dCI6eyJjb250ZW50" +
      "X3R5cGUiOiJ0ZXh0L3BsYWluIiwicmV2cG9zIjozLCJkaWdlc3QiOiJtZDUtcVVVWXFTND" +
      "FSaHdGMFRyQ3NUQXhGZz09IiwibGVuZ3RoIjoyOSwiZm9sbG93cyI6dHJ1ZSwiZW5jb2Rp" +
      "bmciOiJnemlwIiwiZW5jb2RlZF9sZW5ndGgiOjQ3fSwiYmFyLnR4dCI6eyJjb250ZW50X3" +
      "R5cGUiOiJ0ZXh0L3BsYWluIiwicmV2cG9zIjozLCJkaWdlc3QiOiJtZDUtY0NrR2JDZXNi" +
      "MTd4aldZTlYwR1htZz09IiwibGVuZ3RoIjowLCJmb2xsb3dzIjp0cnVlLCJlbmNvZGluZy" +
      "I6Imd6aXAiLCJlbmNvZGVkX2xlbmd0aCI6MjB9LCJiYXoudHh0Ijp7ImNvbnRlbnRfdHlw" +
      "ZSI6InRleHQvcGxhaW4iLCJyZXZwb3MiOjMsImRpZ2VzdCI6Im1kNS1xVVVZcVM0MVJod0" +
      "YwVHJDc1RBeEZnPT0iLCJsZW5ndGgiOjI5LCJmb2xsb3dzIjp0cnVlLCJlbmNvZGluZyI6" +
      "Imd6aXAiLCJlbmNvZGVkX2xlbmd0aCI6NDd9fX0NCi0tYzJkYzJhZWZhNDAxNjJkZjBiY2" +
      "YwOWFhNjVmN2Y2MTkNCkNvbnRlbnQtRGlzcG9zaXRpb246IGF0dGFjaG1lbnQ7IGZpbGVu" +
      "YW1lPSJmb28udHh0Ig0KQ29udGVudC1UeXBlOiB0ZXh0L3BsYWluDQpDb250ZW50LUxlbm" +
      "d0aDogNDcNCkNvbnRlbnQtRW5jb2Rpbmc6IGd6aXANCg0KH/0IAAAAAAAAAwv9/SxWAP1E" +
      "/f39/VQzE/08/f39/RT9/QoSAP39/TwdAAAADQotLWMyZGMyYWVmYTQwMTYyZGYwYmNmMD" +
      "lhYTY1ZjdmNjE5DQpDb250ZW50LURpc3Bvc2l0aW9uOiBhdHRhY2htZW50OyBmaWxlbmFt" +
      "ZT0iYmFyLnR4dCINCkNvbnRlbnQtVHlwZTogdGV4dC9wbGFpbg0KQ29udGVudC1MZW5ndG" +
      "g6IDIwDQpDb250ZW50LUVuY29kaW5nOiBnemlwDQoNCh/9CAAAAAAAAAMDAAAAAAAAAAAA" +
      "DQotLWMyZGMyYWVmYTQwMTYyZGYwYmNmMDlhYTY1ZjdmNjE5DQpDb250ZW50LURpc3Bvc2" +
      "l0aW9uOiBhdHRhY2htZW50OyBmaWxlbmFtZT0iYmF6LnR4dCINCkNvbnRlbnQtVHlwZTog" +
      "dGV4dC9wbGFpbg0KQ29udGVudC1MZW5ndGg6IDQ3DQpDb250ZW50LUVuY29kaW5nOiBnem" +
      "lwDQoNCh/9CAAAAAAAAAML/f0sVgD9RP39/f1UMxP9PP39/f0U/f0KEgD9/f08HQAAAA0K" +
      "LS1jMmRjMmFlZmE0MDE2MmRmMGJjZjA5YWE2NWY3ZjYxOS0tDQotLWU1MDU2ODczNGUzNT" +
      "Y5OTdkMjI5NTk1OTM2MDdiODM4LS0=";

    var binString = base64ToBinary(base64);
    // not needed apparently
    // var boundary = 'e50568734e356997d22959593607b838';
    var multipart = parseMultipart(binString);

    multipart.should.deep.equal({
      "_id": "bin_doc",
      "_rev": "3-7cc3acc97107948e02b0061d4d3233a9",
      "_revisions": {
        "start": 3,
        "ids": [
          "7cc3acc97107948e02b0061d4d3233a9",
          "4c33fdbefe528298dd2f37b3e2a8ab25",
          "507ca61ff36ce1049740748a87cc57a1"
        ]
      },
      "_attachments": {
        "foo.txt": {
          "content_type": "text/plain",
          "digest": "md5-qUUYqS41RhwF0TrCsTAxFg==",
          "length": 29,
          "content": "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
        },
        "bar.txt": {
          "content_type": "text/plain",
          "digest": "md5-cCkGbCesb17xjWYNV0GXmg==",
          "length": 0,
          "content": ""
        },
        "baz.txt": {
          "content_type": "text/plain",
          "digest": "md5-qUUYqS41RhwF0TrCsTAxFg==",
          "length": 29,
          "content": "VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIHRleHQ="
        }
      }
    });



  });

});