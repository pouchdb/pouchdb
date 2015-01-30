'use strict';

/* global blobUtil */

function randomColor() {
  return '#' + ((1<<24) * Math.random()|0).toString(16);
}
function randomNum(limit) {
  return Math.floor(Math.random() * limit);
}

function makeCanvas(size) {
  var canvas;
  if (process.browser) {
    canvas = document.createElement('canvas');
  } else {
    canvas = new require('canvas');
  }
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function drawRandomCircle(context, size) {
  // draw some random circles of various colors
  context.strokeStyle = randomColor();
  context.fillStyle = randomColor();
  context.beginPath();
  context.arc(randomNum(size),randomNum(size),randomNum(size),randomNum(size),
    Math.PI * 2,true);
  context.closePath();
  context.stroke();
  context.fill();
}

module.exports = function (PouchDB, opts) {

  // need to use bluebird for promises everywhere, so we're comparing
  // apples to apples
  require('bluebird'); // var Promise = require('bluebird');
  var utils = require('./utils');

  var testCases = [
    {
      name: 'basic-attachments',
      assertions: 1,
      iterations: 500,
      setup: function (db, callback) {

        var canvas = makeCanvas(300);
        var context = canvas.getContext('2d');
        for (var i = 0; i < 100; i++) {
          drawRandomCircle(context, 300);
        }
        if (process.browser) {
          blobUtil.canvasToBlob(canvas).then(function (blob) {
            db._blob = blob;
            callback();
          });
        } else {
          db._blob = canvas.toBuffer();
          callback();
        }
      },
      test: function (db, itr, doc, done) {
        db.putAttachment(Math.random().toString(), 'foo.txt', db._blob,
          db._blob.type).then(function () {
          done();
        }, done);
      }
    }
  ];

  utils.runTests(PouchDB, 'views', testCases, opts);

};
