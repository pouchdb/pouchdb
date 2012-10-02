var specify  = require('specify')
  , timeout  = require('../helpers').timeout
  , nano     = require('../../nano')
  ;

specify("shared_nano:test", timeout, function (assert) {
  assert.ok(nano.version, "Version is defined");
  assert.ok(nano.path, "Path is defined");
});

specify.run(process.argv.slice(2));
