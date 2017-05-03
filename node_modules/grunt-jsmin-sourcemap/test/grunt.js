module.exports = function (grunt) {
  grunt.file.mkdir('actual');

  grunt.initConfig({
    'pkg': {
      'name': 'grunt-jsmin-sourcemap',
      'version': '1.5.0'
    },
    'jsmin-sourcemap': {
      // // Compact format -- https://github.com/gruntjs/grunt/blob/master/docs/api.md#thisfile--grunttaskcurrentfile
      // 'actual/compact.min.js': 'test_files/jquery.js',
      // // Normal format
      // single: {
      //   src: 'test_files/jquery.js',
      //   dest: 'actual/jquery.min.js',
      //   destMap: 'actual/jquery.js.map'
      // },
      // multi: {
      //   src: ['test_files/jquery.js', 'test_files/underscore.js'],
      //   dest: 'actual/multi.min.js',
      //   destMap: 'actual/multi.js.map'
      // },
      // Package specific interpolation
      interpolation: {
        src: 'test_files/jquery.js',
        dest: 'actual/interpolate.<%= pkg.name %>-<%= pkg.version %>.min.js',
        destMap: 'actual/interpolate.<%= pkg.name %>-<%= pkg.version %>.js.map'
      }
    },
    test: {
      all: '*.test.js'
    }
  });

  // Load in jsmin-sourcemap
  grunt.loadTasks('../tasks');

  // Set up the default task
  grunt.registerTask('default', 'jsmin-sourcemap test');
};