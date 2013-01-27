/*jshint node: true */

console.log(process.env.TRAVIS_SECURE_ENV_VARS);

if (!process.env.TRAVIS_SECURE_ENV_VARS) {
  return;
}

var url = require('url');
var fs = require('fs');
var cp = require('child_process');

var nano = require('nano');
var cors = require('./tests/CORS-Proxy/server.js');

console.log('start');
console.log(process.env.HELLO);
console.log(process.env.SSH_POUCH_KEY);
console.log(typeof process.env.SSH_POUCH_KEY);

var srcFiles = [
  "src/pouch.js", "src/pouch.collate.js", "src/pouch.merge.js",
  "src/pouch.replicate.js", "src/pouch.utils.js",
  "src/adapters/pouch.http.js", "src/adapters/pouch.idb.js",
  "src/adapters/pouch.websql.js", "src/plugins/pouchdb.mapreduce.js"
];

var testFiles = fs.readdirSync("./tests").filter(function(name){
  return (/^test\.([a-z0-9_])*\.js$/).test(name) &&
    name !== 'test.auth_replication.js';
});

var browserConfig = [{
//   browserName: 'chrome',
//   platform: 'Windows 2003',
//   name: 'win2003/chrome',
//   'chrome.switches' : ['disable-file-system']
// }, {
  browserName: 'firefox',
  version: '17',
  platform: 'Windows 2003',
  name: 'win2003/firefox'
// }, {
//   browserName: 'safari',
//   version: '5',
//   platform: 'Windows 2008',
//   name: 'win2008/safari'
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
    concat: {
      amd: {
	src: grunt.utils._.flatten([
          "define('pouchdb',[ 'simple-uuid', 'md5'], " +
            "function(uuid, md5) { ", 'src/pouch.amd.js', srcFiles,
          " return Pouch });"]),
	dest: 'pouch.amd.<%= pkg.release %>.js'
      },
      all: {
	src: grunt.utils._.flatten([
          "(function() { ",
          "src/deps/uuid.js","src/deps/polyfill.js", srcFiles, " })(this);"]),
	dest: 'pouch.<%= pkg.release %>.js'
      }
    },

    min: {
      dist: {
	src: grunt.utils._.flatten([
          "(function() { ", "src/deps/uuid.js","src/deps/polyfill.js",
          srcFiles, " })(this);"]),
	dest: 'pouch.<%= pkg.release %>.min.js'
      }
    },

    // Servers
    server: {
      base: '.',
      port: 8000
    },

    'cors-server': {
      base: 'http://127.0.0.1:5984',
      port: 2020
    },

    'node-qunit': {
      deps: './src/pouch.js',
      code: './src/adapters/pouch.leveldb.js',
      tests: testFiles.map(function (n) { return "./tests/" + n; }),
      done: function(err, res) {
        !err && (testResults['node'] = res);
	return true;
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
        tunneled: false,
        concurrency: 3,
	urls: ["http://tests.pouchdb.com/tests/test.html?test=release-min&id=" +
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
  grunt.registerTask("cors-server", "Runs a CORS proxy", function(){
    var corsUrl = url.parse("http://127.0.0.1:" +
                            (arguments[0] || grunt.config("cors-server.port")));
    var couchUrl = url.parse(grunt.utils._.toArray(arguments).slice(1).join(":") ||
                             grunt.config("cors-server.base"));
    grunt.log.writeln("Starting CORS server " + url.format(corsUrl) +
                      " => " + url.format(couchUrl));
    cors.init(couchUrl, corsUrl);
  });

  grunt.registerTask("forever", "Runs a task forever, exits only on Ctrl+C", function(){
    this.async();
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

  grunt.registerTask('deploy', 'Deploy a live pouch.alpha', function() {
    var done = this.async();
    var src = 'pouch.alpha.min.js';
    var dest ='dale@arandomurl.com:www/pouchdb/pouchdb/testfile';
    var identity = '';

    console.log('in deploy');
    console.log(process.env.WTF);
    console.log(typeof process.env.SSH_POUCH_KEY);
    console.log((typeof process.env.SSH_POUCH_KEY !== 'undefined'));

    if (typeof process.env.SSH_POUCH_KEY !== 'undefined') {
      console.log('writing ssh key');
      fs.writeFileSync('id_rsa', process.env.SSH_POUCH_KEY, 'utf8');
      fs.chmodSync('id_rsa', '600');
      identity = '-o IdentityFile=./id_rsa -o UserKnownHostsFile=/dev/null '
        + '-o StrictHostKeyChecking=no ';
    }
    console.log('Identity:', identity);

    cp.exec('scp ' + identity + src + ' ' + dest, function(err, stdout, stderr) {
      done(true);
    });
  });

  grunt.loadNpmTasks('grunt-saucelabs');
  grunt.loadNpmTasks('grunt-node-qunit');

  grunt.registerTask("build", "concat min");
  grunt.registerTask("test", "build deploy server cors-server saucelabs-qunit publish-results");

  grunt.registerTask('default', 'build');
};
