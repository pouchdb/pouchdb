function inherits(A, B) {
  A.prototype = Object.create(B.prototype, {
    constructor: { value: A }
  });
}

export function createClass(parent, init) {
  let klass = function (...args) {
    if (!(this instanceof klass)) {
      return new klass(...args);
    }
    init.apply(this, args);
  };
  inherits(klass, parent);
  return klass;
}
