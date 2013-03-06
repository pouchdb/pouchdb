/*jshint node: true */

var url = require('url');
var fs = require('fs');
var cp = require('child_process');

var nano = require('nano');
var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");

var srcFiles = [
  "src/pouch.js", "src/pouch.collate.js", "src/pouch.merge.js",
  "src/pouch.replicate.js", "src/pouch.utils.js", "src/pouch.adapter.js",
  "src/adapters/pouch.http.js", "src/adapters/pouch.idb.js",
  "src/adapters/pouch.websql.js", "src/plugins/pouchdb.mapreduce.js"
];

var testFiles = fs.readdirSync("./tests").filter(function(name){
  return (/^test\.([a-z0-9_])*\.js$/).test(name) &&
    name !== 'test.spatial.js' && name !== 'test.auth_replication.js';
});

var browserConfig = [{
  browserName: 'chrome',
  platform: 'Windows 2003',
  name: 'win2003/chrome',
  'chrome.switches' : ['disable-file-system']
}, {
  browserName: 'firefox',
  version: '17',
  platform: 'Windows 2003',
  name: 'win2003/firefox'
// }, {
//   browserName: 'opera',
//   version: '12',
//   platform: 'Windows 2008',
//   name: 'win2008/opera'
}];

module.exports = function(grunt) {

  var testStartTime = new Date();
  var testResults = {};

  grunt.initConfig({
    pkg: '<json:package.json>',

    clean: {
      build : ["./dist"],
      "node-qunit": ["./testdb_*"]
    },

    concat: {
      options: {
        banner: "/*PouchDB*/\n(function() {\n ",
        footer: "\n })(this);"
      },
      amd: {
        options: {
          banner : "define('pouchdb',[ 'simple-uuid', 'md5'], function(uuid, md5) { " +
            "Math.uuid = uuid.uuid; Crypto = {MD5 : md5.hex}; $ = jquery;",
          footer : " return Pouch });"
        },
        src: grunt.util._.flatten([
          "<banner:meta.amd.top>", srcFiles,"<banner:meta.amd.bottom>"
        ]),
        dest: 'dist/pouchdb.amd-nightly.js'
      },
      all: {
        src: grunt.util._.flatten([
          "src/deps/uuid.js",
          "src/deps/polyfill.js", "src/deps/extend.js","src/deps/ajax.js", srcFiles
        ]),
        dest: 'dist/pouchdb-nightly.js'
      },
      spatial: {
        src: grunt.util._.flatten([
          "src/deps/uuid.js",
          "src/deps/polyfill.js", "src/deps/extend.js","src/deps/ajax.js", srcFiles,
          "src/plugins/pouchdb.spatial.js"
        ]),
        dest: 'dist/pouchdb.spatial-nightly.js'
      }
    },

    uglify: {
      dist: {
        src: "./dist/pouchdb-nightly.js",
        dest: 'dist/pouchdb-nightly.min.js'
      },
      spatial: {
        src:  'dist/pouchdb.spatial-nightly.js',
        dest:  'dist/pouchdb.spatial-nightly.min.js'
      }
    },

    // Servers
    connect : {
      server: {
        options: {
          base: '.',
          port: 8000
        }
      }
    },

    'cors-server': {
      base: 'http://127.0.0.1:5984',
      port: 2020
    },

    jshint: {
      files: ["src/adapter/*.js", "tests/*.js", "src/*.js"]
    },

    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        eqnull: true,
        browser: true,
        strict: true,
        globalstrict: true
      },
      globals: {
          // Tests.
        _: true,
        QUnit: true,
        asyncTest: true,
        test: true,
        DB: true,
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
        unescape: true,
        process: true,
        global: true,
        require: true,
        console: true,
        Pouch: true
      }
    },
    'node-qunit': {
      all: {
        deps: ['./src/deps/extend.js','./src/deps/ajax.js','./src/pouch.js'],
        code: './src/adapters/pouch.leveldb.js',
        tests: testFiles.map(function (n) { return "./tests/" + n; }),
        done: function(err, res) {
          !err && (testResults['node'] = res);
	       return true;
        }
      }
    },

    'saucelabs-qunit': {
      all: {
	username: 'pouchdb',
	key: '97de9ee0-2712-49f0-9b17-4b9751d79073',
	testname: 'PouchDB Tests',
	tags: [process.env.TRAVIS_BRANCH || "unknown"],
	testTimeout: 1000 * 60 * 15, // 15 minutes
	testInterval: 1000 * 30, // 30 seconds
  tunnelTimeout: 1000 * 60 * 15, // 15 minutes
	urls: ["http://127.0.0.1:8000/tests/test.html?test=release-min&id=" +
               testStartTime.getTime() + "&testFiles=" + testFiles.join(',')],
	browsers: browserConfig,
	onTestComplete: function(status, page, config, browser) {
	  var done = this.async();
	  var browserDB = nano('http://127.0.0.1:5984').use('test_results');
          var retries = 0;
	  (function getResults() {
	    browser.eval("window.testReport", function(err, val) {
	      testResults[config.name] = err ? "No results" : val;
	      done(true);
	    });
	  }());
	}
      }
    },
    'publish-results': {
      server: 'http://pouchdb.iriscouch.com',
      db: 'test_results'
    }
  });

  // Custom tasks
  grunt.registerTask("forever", 'Runs forever', function(){
    this.async();
  })

  grunt.registerTask("cors-server", "Runs a CORS proxy", function(){
    var corsPort = arguments[0] || grunt.config("cors-server.port");
    var couchUrl = grunt.util._.toArray(arguments).slice(1).join(":") ||
      grunt.config("cors-server.base");
    grunt.log.writeln("Starting CORS server " + corsPort + " => " + couchUrl);

    cors_proxy.options = {target: couchUrl};
    http_proxy.createServer(cors_proxy).listen(corsPort);
  });

  grunt.registerTask("publish-results",
                     "Publishes the results of the test to a server", function(){
    var done = this.async();
    cp.exec('git rev-list HEAD --max-count=1', function(err, stdout, stderr) {
      var results = {
	started: testStartTime,
	completed: new Date(),
	git_hash: stdout.replace(/[\n\r]/g, ''),
	passed: true,
	runs: {},
	runner: 'grunt'
      };
      for (var key in testResults) {
	results.runs[key] = {
	  started: testResults[key].started || "",
	  completed: testResults[key].completed || "",
	  passed: !!(testResults[key].passed),
	  report: testResults[key]
	};
  console.log("Test Result for %s is %s".yellow , key , results.runs[key].passed);
	results.passed = results.passed && results.runs[key].passed;
      }
      nano(grunt.config("publish-results.server"))
        .use(grunt.config("publish-results.db"))
        .insert(results, testStartTime.getTime() + "", function(err, body){
	  console.log(testStartTime.getTime(), err ? err.message : body);
	  done(results.passed && err == null);
        });
    });
  });

  grunt.loadNpmTasks('grunt-saucelabs');
  grunt.loadNpmTasks('grunt-node-qunit');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask("build", ["concat:amd", "concat:all" , "uglify:dist"]);
  
  grunt.registerTask("testSetup", ["jshint", "build", "connect", "cors-server"]);
  grunt.registerTask("test", ["testSetup", "node-qunit" ,"saucelabs-qunit", "publish-results"]);
  grunt.registerTask("full", ["concat", "uglify"]);
  grunt.registerTask("spatial", ["concat:spatial", "uglify:spatial"]);
  grunt.registerTask('default', 'build');
};
