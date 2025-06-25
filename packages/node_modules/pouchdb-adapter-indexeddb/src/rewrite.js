'use strict';

const IDB_NULL = Number.MIN_SAFE_INTEGER;
const IDB_FALSE = Number.MIN_SAFE_INTEGER + 1;
const IDB_TRUE = Number.MIN_SAFE_INTEGER + 2;

// These are the same as below but without the global flag
// we want to use RegExp.test because it's really fast, but the global flag
// makes the regex const stateful (seriously) as it walked through all instances
const TEST_KEY_INVALID = /^[^a-zA-Z$]|[^a-zA-Z0-9$]+/;
const TEST_PATH_INVALID = /\\.|(^|\.)[^a-zA-Z$]|[^a-zA-Z0-9$.]+/;
function needsSanitise(name) {
  return TEST_KEY_INVALID.test(name);
}

//
// IndexedDB only allows valid JS names in its index paths, whereas JSON allows
// for any string at all. This converts invalid JS names to valid ones, to allow
// for them to be indexed.
//
// For example, "foo-bar" is a valid JSON key, but cannot be a valid JS name
// (because that would be read as foo minus bar).
//
// Very high level rules for valid JS names are:
//  - First character cannot start with a number
//  - Otherwise all characters must be be a-z, A-Z, 0-9, or $.
//  - Underscores (_) are encoded even though legal, to avoid collisions with
//    encoded illegal characters
//  - We allow . unless the name represents a single field, as that represents
//    a deep index path.
// See: https://www.w3.org/TR/IndexedDB/#key-path-construct
//
// This is more aggressive than it needs to be, but also simpler.
//
const KEY_INVALID = new RegExp(TEST_KEY_INVALID.source, 'g');
const PATH_INVALID = new RegExp(TEST_PATH_INVALID.source, 'g');
const SLASH = '\\'.charCodeAt(0);
const IS_DOT = '.'.charCodeAt(0);

function sanitise(name, isPath) {
  const correctCharacters = function (match) {
    let good = '';
    for (let i = 0; i < match.length; i++) {
      const code = match.charCodeAt(i);
      // If you're sanitising a path, a slash character is there to be interpreted
      // by whatever parses the path later as "escape the next thing".
      //
      // e.g., if you want to index THIS string:
      //   {"foo": {"bar.baz": "THIS"}}
      // Your index path would be "foo.bar\.baz".

      if (code === IS_DOT && isPath && i === 0) {
        good += '.';
      } else if (code === SLASH && isPath) {
        continue;
      } else {
        good += '_c' + code + '_';
      }
    }
    return good;
  };

  if (isPath) {
    return name.replace(PATH_INVALID, correctCharacters);
  } else {
    return name.replace(KEY_INVALID, correctCharacters);
  }
}

function needsRewrite(data) {
  for (const key of Object.keys(data)) {
    if (needsSanitise(key)) {
      return true;
    } else if (data[key] === null || typeof data[key] === 'boolean') {
      return true;
    } else if (typeof data[key] === 'object' && needsRewrite(data[key])) {
      return true;
    }
  }
}

function rewriteValue(v) {
  if (v === null) {
    return IDB_NULL;
  } else if (typeof v === 'boolean') {
    return v ? IDB_TRUE : IDB_FALSE;
  } else if (typeof v === 'object') {
    return rewriteObject(v);
  } else {
    return v;
  }
}

function rewriteObject(data) {
  if (!needsRewrite(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(rewriteValue);
  }

  return Object.keys(data).reduce((clone, k) => {
    clone[sanitise(k)] = rewriteValue(data[k]);
    return clone;
  }, {});
}

export {
  IDB_NULL,
  IDB_TRUE,
  IDB_FALSE,
  rewriteObject as rewrite,
  sanitise
};
