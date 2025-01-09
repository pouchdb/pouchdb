import {
  getFieldFromDoc,
  setFieldInDoc,
  parseField
} from 'pouchdb-selector-core';

const nativeFlat = (...args) => args.flat(Infinity);

const polyFlat = (...args) => {
  let res = [];
  for (const subArr of args) {
    if (Array.isArray(subArr)) {
      res = res.concat(polyFlat(...subArr));
    } else {
      res.push(subArr);
    }
  }
  return res;
};

const flatten = typeof Array.prototype.flat === 'function'
  ? nativeFlat
  : polyFlat;

function mergeObjects(arr) {
  const res = {};
  for (const element of arr) {
    Object.assign(res, element);
  }
  return res;
}

// Selects a list of fields defined in dot notation from one doc
// and copies them to a new doc. Like underscore _.pick but supports nesting.
function pick(obj, arr) {
  const res = {};
  for (const field of arr) {
    const parsedField = parseField(field);
    const value = getFieldFromDoc(obj, parsedField);
    if (typeof value !== 'undefined') {
      setFieldInDoc(res, parsedField, value);
    }
  }
  return res;
}

// e.g. ['a'], ['a', 'b'] is true, but ['b'], ['a', 'b'] is false
function oneArrayIsSubArrayOfOther(left, right) {
  for (let i = 0, len = Math.min(left.length, right.length); i < len; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

// e.g.['a', 'b', 'c'], ['a', 'b'] is false
function oneArrayIsStrictSubArrayOfOther(left, right) {
  if (left.length > right.length) {
    return false;
  }

  return oneArrayIsSubArrayOfOther(left, right);
}

// same as above, but treat the left array as an unordered set
// e.g. ['b', 'a'], ['a', 'b', 'c'] is true, but ['c'], ['a', 'b', 'c'] is false
function oneSetIsSubArrayOfOther(left, right) {
  left = left.slice();
  for (const field of right) {
    if (!left.length) {
      break;
    }
    const leftIdx = left.indexOf(field);
    if (leftIdx === -1) {
      return false;
    } else {
      left.splice(leftIdx, 1);
    }
  }
  return true;
}

function arrayToObject(arr) {
  const res = {};
  for (const field of arr) {
    res[field] = true;
  }
  return res;
}

function max(arr, fun) {
  let max = null;
  let maxScore = -1;
  for (const element of arr) {
    const score = fun(element);
    if (score > maxScore) {
      maxScore = score;
      max = element;
    }
  }
  return max;
}

function arrayEquals(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0, len = arr1.length; i < len; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

/**
 * Callbackifyable wrapper for async functions
 *
 * @template T, Args
 * @param {(...args: Args) => Promise<T>} fun
 * @returns {<CBArgs = [...Args, (err: any, value: T) => void], InnerArgs extends Args | CBArgs>(...innerArgs: InnerArgs) => InnerArgs extends CBArgs ? void : Promise<T>}
 *
 * @example
 * const fn = resolveToCallback(async () => { return 42; })
 * // with callback:
 * fn((err, value) => { ... })
 * // with await:
 * const value = await fn()
 */
function resolveToCallback(fun) {
  return function (...args) {
    const maybeCallback = args[args.length - 1];
    if (typeof maybeCallback === "function") {
      const fulfilled = maybeCallback.bind(null, null);
      const rejected = maybeCallback.bind(null);
      fun.apply(this, args.slice(0, -1)).then(fulfilled, rejected);
    } else {
      return fun.apply(this, args);
    }
  };
}

export {
  arrayEquals,
  arrayToObject,
  flatten,
  max,
  mergeObjects,
  oneArrayIsStrictSubArrayOfOther,
  oneArrayIsSubArrayOfOther,
  oneSetIsSubArrayOfOther,
  pick,
  resolveToCallback,
  uniq
};
