function noop() {}

if (typeof performance !== 'undefined' &&
    performance.mark && performance.measure) {
  module.exports = performance;
} else {
  module.exports = {
    mark: noop,
    measure: noop
  };
}