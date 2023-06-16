import { g as getDefaultExportFromCjs } from './_commonjsHelpers-24198af3.js';

var inherits$1 = {exports: {}};

var inherits_browser = {exports: {}};

var hasRequiredInherits_browser;

function requireInherits_browser () {
	if (hasRequiredInherits_browser) return inherits_browser.exports;
	hasRequiredInherits_browser = 1;
	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      ctor.prototype = Object.create(superCtor.prototype, {
	        constructor: {
	          value: ctor,
	          enumerable: false,
	          writable: true,
	          configurable: true
	        }
	      });
	    }
	  };
	} else {
	  // old school shim for old browsers
	  inherits_browser.exports = function inherits(ctor, superCtor) {
	    if (superCtor) {
	      ctor.super_ = superCtor;
	      var TempCtor = function () {};
	      TempCtor.prototype = superCtor.prototype;
	      ctor.prototype = new TempCtor();
	      ctor.prototype.constructor = ctor;
	    }
	  };
	}
	return inherits_browser.exports;
}

try {
  var util = require('util');
  /* istanbul ignore next */
  if (typeof util.inherits !== 'function') throw '';
  inherits$1.exports = util.inherits;
} catch (e) {
  /* istanbul ignore next */
  inherits$1.exports = requireInherits_browser();
}

var inheritsExports = inherits$1.exports;
var inherits = /*@__PURE__*/getDefaultExportFromCjs(inheritsExports);

export { inherits as a, inheritsExports as i };
