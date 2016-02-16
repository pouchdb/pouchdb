export default {
  name: 'localstorage',
  valid: function () {
    return typeof localStorage !== 'undefined';
  },
  use_prefix: true
};
