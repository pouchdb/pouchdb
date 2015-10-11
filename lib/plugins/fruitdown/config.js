export default {
  name: 'fruitdown',
  valid: function () {
    return !!global.indexedDB;
  },
  use_prefix: true
};
