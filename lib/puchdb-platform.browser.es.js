function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var src = import('./node-8c918d45.js');

var index = /*@__PURE__*/getDefaultExportFromCjs(src);

export { index as default };
