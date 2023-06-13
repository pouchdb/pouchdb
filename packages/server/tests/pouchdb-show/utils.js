const stuff = require('../testutils');
const Show = require('../../packages/node_modules/pouchdb-show');

stuff.PouchDB.plugin(Show);

stuff.showDocument = {
	_id: '_design/test',
	shows: {
		myshow: `function (doc, req) {
			if (!doc) {
				return {body: 'no doc'}
			} else {
				return {body: doc.description}
			}
		};\n`,
		args: `function (doc, req) {
			return toJSON({args: [doc, req]});
		}`,
		usingProviders: `function (doc, req) {
			provides('json', function () {
				return toJSON({message: 'Hello World!'});
			});
			provides('html', function () {
				log({'type': 'is', 'html': 'for', 'this': 'func'})
				return '<h1>Hello World!</h1>';
			});
			provides('css', function () {
				return "body {content: 'Hello World!'}";
			});
			registerType('ascii-binary', 'application/octet-stream; charset=ascii');
			provides('ascii-binary', function () {
				return {
					'base64': 'SGVsbG8gV29ybGQh'
				};
			});
		}`,
		oldStyleJson: `function (doc, req) {
			return {
				json: {
					old_style: 'json'
				}
			};
		}`,
		empty: `function (doc, req) {}`,
		nofunc: `'Hello World!'`,
		invalidsyntax: `function (doc, req)) {}`,
		invalidReturnTypeAndProvides: `function (doc, req) {
			provides('html', function () {
				return 42;
			});
		}`,
		throwingError: `function (doc, req) {
			throw new Error('Hello World!')
		}`,
		throwingErrorInProvides: `function (doc, req) {
			provides('text', function () {
				throw new Error('Hello World!');
			});
		}`,
		invalidRespObject: `function (doc, req) {
			return {body: 'test', abc: 'test'};
		}`
	}
};

stuff.checkUserAgent = ua => {
	ua.should.contain('Mozilla');
	ua.should.contain('Gecko');
};

stuff.checkUuid = uuid => {
	uuid.should.be.a('string');
	uuid.length.should.be.greaterThan(30);
};

module.exports = stuff;
