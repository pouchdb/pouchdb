module.exports = function(grunt){
	var srcFiles = ['src/deps/uuid.js', 'src/pouch.js', 'src/pouch.collate.js', 'src/pouch.merge.js', 'src/pouch.replicate.js', 'src/pouch.utils.js', 'src/adapters/pouch.http.js', 'src/adapters/pouch.idb.js'];
	var release = "alpha";
	// Project configuration.
	grunt.initConfig({
		pkg: '<json:package.json>',
		meta: {
			banner: '/*! <%= pkg.name %> */'
		},
		test: {
			files: ['test/**/*.js']
		},
		concat: {
			dist: {
				src: srcFiles,
				dest: 'dist/pouch.' + release + '.js'
			}
		},
		'jsmin-sourcemap': {
			all: {
				src: srcFiles,
				dest: 'dist/pouch.' + release + '.min.js',
				srcRoot: '..'
			}
		},
		watch: {
			files: '<config:lint.files>',
			tasks: 'lint test'
		},
		jshint: {
			options: {
				camelcase: true,
				nonew: true,
				curly: true,//require { }
				eqeqeq: true,//=== instead of ==
				immed: true,//wrap IIFE in parentheses
				latedef: true,//variable declared before usage
				newcap: true,//capitalize class names
				undef: true,//checks for undefined variables
				regexp: true,
				evil: true,
				eqnull: true,//== allowed for undefined/null checking
				expr: true,//allow foo && foo()
				browser: true//browser environment
			},
			globals: {
				// Shim.
				DEBUG: true,
				console: true,
				DOMException: true,
				IDBTransaction: true,
				idbModules: true,
				logger: true,
				
				// Tests.
				_: true,
				asyncTest: true,
				DB: true,
				dbVersion: true,
				deepEqual: true,
				equal: true,
				expect: true,
				fail: true,
				module: true,
				nextTest: true,
				notEqual: true,
				ok: true,
				sample: true,
				start: true,
				stop: true,
				queuedAsyncTest: true,
				queuedModule: true,
				unescape: true
			}
		},
		uglify: {}
	});
	
	// Default task.
	grunt.loadNpmTasks('grunt-jsmin-sourcemap');
	grunt.registerTask('default', 'concat jsmin-sourcemap');
};
