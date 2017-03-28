// rollup plugin to remove guardedConsole() calls

function removeGuardedConsole() {
  return {
    name: 'remove-guarded-console',

    transform: function (code) {
      // fairly hacky, should probably be an AST transform, but this
      // works for our own codebase
      if (!/function guardedConsole/.test(code)) {
        code = code.replace(/guardedConsole.bind\([\S\s]+?\)/g,
          '/* removed guarded console */ function () {/* noop */}');
        code = code.replace(/guardedConsole\([\S\s]+?\);(\s)/g,
          '/* removed guarded console */$1');
      }
      return {
        code: code
      };
    }
  };
}
module.exports = removeGuardedConsole;