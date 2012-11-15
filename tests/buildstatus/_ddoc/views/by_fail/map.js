"use strict";

function by_fail(doc) {

  if (!('passed' in doc) || doc.passed === true) {
    return;
  }

  emit(doc.started, {});
}