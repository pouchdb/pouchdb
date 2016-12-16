// based on https://github.com/montagejs/collections
/* global Map,Set */

import ShimmedMap from './Map';
import ShimmedSet from './Set';
import supportsMapAndSet from './supportsMapAndSet';

var ExportedSet;
var ExportedMap;

if (process.env.COVERAGE) { // don't penalize ourselves on coverage
  ExportedSet = ShimmedSet;
  ExportedMap = ShimmedMap;
} else {
  if (supportsMapAndSet()) { // prefer built-in Map/Set
    ExportedSet = Set;
    ExportedMap = Map;
  } else { // fall back to our polyfill
    ExportedSet = ShimmedSet;
    ExportedMap = ShimmedMap;
  }
}

export {
  ExportedSet as Set,
  ExportedMap as Map
};
