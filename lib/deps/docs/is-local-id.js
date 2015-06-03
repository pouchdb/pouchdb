'use strict';

function isLocalId(id) {
  return (/^_local/).test(id);
}

module.exports = isLocalId;