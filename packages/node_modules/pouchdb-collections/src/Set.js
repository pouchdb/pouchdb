import Map from './Map';

function Set(array) {
  this._store = new Map();

  // init with an array
  if (array && Array.isArray(array)) {
    for (var i = 0, len = array.length; i < len; i++) {
      this.add(array[i]);
    }
  }
}
Set.prototype.add = function (key) {
  return this._store.set(key, true);
};
Set.prototype.has = function (key) {
  return this._store.has(key);
};
Set.prototype.forEach = function (cb) {
  this._store.forEach(function (value, key) {
    cb(key);
  });
};
Object.defineProperty(Set.prototype, 'size', {
  get: function () {
    return this._store.size;
  }
});

export default Set;