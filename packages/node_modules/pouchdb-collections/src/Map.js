function mangle(key) {
  return '$' + key;
}
function unmangle(key) {
  return key.substring(1);
}
function Map() {
  this._store = {};
}
Map.prototype.get = function (key) {
  var mangled = mangle(key);
  return this._store[mangled];
};
Map.prototype.set = function (key, value) {
  var mangled = mangle(key);
  this._store[mangled] = value;
  return true;
};
Map.prototype.has = function (key) {
  var mangled = mangle(key);
  return mangled in this._store;
};
Map.prototype.delete = function (key) {
  var mangled = mangle(key);
  var res = mangled in this._store;
  delete this._store[mangled];
  return res;
};
Map.prototype.forEach = function (cb) {
  var keys = Object.keys(this._store);
  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i];
    var value = this._store[key];
    key = unmangle(key);
    cb(value, key);
  }
};
Object.defineProperty(Map.prototype, 'size', {
  get: function () {
    return Object.keys(this._store).length;
  }
});

export default Map;