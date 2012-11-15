"use strict";

function by_started(doc) {

  function isDate(d) {
    return Object.prototype.toString.call(d) === '[object Date]' && isFinite(d);
  }

  if (!('started' in doc)) return;
  var started = new Date(doc.started);
  if (!isDate(started)) return;

  emit(doc.started, {
    started: doc.started,
    completed: doc.completed,
    passed: doc.passed,
    git_hash: doc.git_hash,
    travis_job: doc.travis_job
  });
}