module.exports = function(grunt) {
	var srcFiles = [ 'src/deps/uuid.js', 'src/pouch.js', 'src/pouch.collate.js',
			'src/pouch.merge.js', 'src/pouch.replicate.js',
			'src/pouch.utils.js', 'src/adapters/pouch.http.js',
			'src/adapters/pouch.idb.js' ];

	grunt.initConfig({
		pkg : '<json:package.json>',
		meta : {
			banner : '/*! <%= pkg.name %> */'
		},
		test : {
			files : [ 'test/**/*.js' ]
		},
		concat : {
			dist : {
				src : srcFiles,
				dest : '<%= pkg.name %>.<%= pkg.release %>.js'
			}
		},
		'jsmin-sourcemap' : {
			all : {
				src : srcFiles,
				dest : 'dist/<%= pkg.name %>.<%= pkg.release %>.min.js',
				srcRoot : '.'
			}
		}
	});

	// Default task.
	grunt.loadNpmTasks('grunt-jsmin-sourcemap');
	grunt.registerTask('default', 'concat jsmin-sourcemap');

};
