/*
    Copyright 2015, Marten de Vries

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

'use strict';

var events = require('events');
var changesEvents = 'change complete error create update delete'.split(' ');

module.exports = function createChangeslikeWrapper(handler) {
  return changesLikeWrapper.bind(null, handler);
};

function changesLikeWrapper(handler, origChanges, args) {
  var newResult = new events.EventEmitter();
  var isCancelled = false;

  var promise = handler(function () {
    var origResult = origChanges();

    changesEvents.forEach(function (event) {
      origResult.on(event, newResult.emit.bind(newResult, event));
    });
    if (isCancelled) {
      origResult.cancel();
   } else {
      newResult.on('cancel', function () {
        origResult.cancel();
      });
    }

    return origResult;
  }, args);

  newResult.then = promise.then.bind(promise);
  newResult.catch = promise.catch.bind(promise);
  newResult.cancel = function () {
    isCancelled = true;
    newResult.emit('cancel');
    newResult.removeAllListeners();
  };

  return newResult;
}
