// based on https://github.com/montagejs/collections
function mangle(key) {
  return '$' + key;
}
function unmangle(key) {
  return key.substring(1);
}
function LazyMap() {
  this.store = {};
}
LazyMap.prototype.get = function (key) {
  var mangled = mangle(key);
  return this.store[mangled];
};
LazyMap.prototype.set = function (key, value) {
  var mangled = mangle(key);
  this.store[mangled] = value;
  return true;
};
LazyMap.prototype.has = function (key) {
  var mangled = mangle(key);
  return mangled in this.store;
};
LazyMap.prototype.delete = function (key) {
  var mangled = mangle(key);
  var res = mangled in this.store;
  delete this.store[mangled];
  return res;
};
LazyMap.prototype.forEach = function (cb) {
  var keys = Object.keys(this.store);
  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i];
    var value = this.store[key];
    key = unmangle(key);
    cb(value, key);
  }
};

function LazySet(array) {
  this.store = new LazyMap();

  // init with an array
  if (array && Array.isArray(array)) {
    for (var i = 0, len = array.length; i < len; i++) {
      this.add(array[i]);
    }
  }
}
LazySet.prototype.add = function (key) {
  return this.store.set(key, true);
};
LazySet.prototype.has = function (key) {
  return this.store.has(key);
};

export {
  LazySet as Set,
  LazyMap as Map
};
