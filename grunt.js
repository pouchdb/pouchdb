/* global module:false */
module.exports = function(grunt){
	var srcFiles = ["src/pouch.js", "src/pouch.collate.js", "src/pouch.merge.js", "src/pouch.replicate.js", "src/pouch.utils.js", "src/adapters/pouch.http.js", "src/adapters/pouch.idb.js"];
	var testFiles = require('fs').readdirSync("./tests").filter(function(name){
		return /^test\.([a-z_])*\.js$/.test(name);
	});
	
	var testStartTime = new Date();
	var testResults = {};
	
	var i = 0, browserConfig = [{
		browserName: 'chrome',
		platform: 'Windows 2003',
		name: 'win2003/chrome'
	}, {
		browserName: 'firefox',
		version: '17',
		platform: 'Windows 2003',
		name: 'win2003/firefox'
	}];
	
	var nano = require('nano');
	
	grunt.initConfig({
		pkg: '<json:package.json>',
		concat: {
			amd: {
				src: grunt.utils._.flatten(["define('pouchdb',['jquery', 'simple-uuid', 'md5'], function(jquery, uuid, md5) { ", 'src/pouch.amd.js', srcFiles, " return Pouch });"]),
				dest: 'pouch.amd.<%= pkg.release %>.js'
			},
			all: {
				src: grunt.utils._.flatten(["(function() { ", "src/deps/jquery-1.7.1.min.js", "src/deps/uuid.js", srcFiles, " })(this);"]),
				dest: 'pouch.<%= pkg.release %>.js'
			}
		},
		
		min: {
			dist: {
				src: grunt.utils._.flatten(["(function() { ", "src/deps/jquery-1.7.1.min.js", "src/deps/uuid.js", srcFiles, " })(this);"]),
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
			tests: testFiles.map(function(n){
				return "./tests/" + n;
			}),
			done: function(err, res){
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
				urls: ["http://127.0.0.1:8000/tests/test.html?test=release-min&id=" + testStartTime.getTime() + "&testFiles=" + testFiles.join(',')],
				browsers: browserConfig,
				onTestComplete: function(status, page, config){
					var done = this.async();
					var browserDB = require('nano')('http://127.0.0.1:5984').use('test_results'), retries = 0;
					(function getResults(){
						browserDB.get(testStartTime.getTime() + '', function(err, doc){
							if (++retries < 5 && (err || (doc && doc.report && doc.report.length - 1 !== i))) {
								setTimeout(getResults, 3000);
							}
							else {
								testResults[config.name] = retries >= 5 ? "No results" : doc.report[i++];
								done(true);
							}
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
		var url = require('url');
		var corsUrl = url.parse("http://127.0.0.1:" + (arguments[0] || grunt.config("cors-server.port")));
		var couchUrl = url.parse(grunt.utils._.toArray(arguments).slice(1).join(":") || grunt.config("cors-server.base"));
		grunt.log.writeln("Starting CORS server " + url.format(corsUrl) + " => " + url.format(couchUrl));
		require('./tests/CORS-Proxy/server.js').init(couchUrl, corsUrl);
	});
	
	grunt.registerTask("forever", "Runs a task forever, exits only on Ctrl+C", function(){
		this.async();
	});
	
	grunt.registerTask("publish-results", "Publishes the results of the test to a server", function(){
		var done = this.async();
		require('child_process').exec('git rev-list HEAD --max-count=1', function(err, stdout, stderr){
			var results = {
				started: testStartTime,
				completed: new Date(),
				git_hash: stdout.replace(/[\n\r]/g, ''),
				passed: true,
				runs: {},
				runner: 'grunt'
			};
			for (key in testResults) {
				results.runs[key] = {
					started: testResults[key].started || "",
					completed: testResults[key].completed || "",
					passed: !!(testResults[key].passed),
					report: testResults[key]
				};
				results.passed = results.passed && results.runs[key].passed;
			}
			nano(grunt.config("publish-results.server")).use(grunt.config("publish-results.db")).insert(results, testStartTime.getTime() + "", function(err, body){
				console.log(testStartTime.getTime(), err ? err.message : body);
				done(results.passed && typeof err === "undefined");
			});
		});
	});
	
	grunt.loadNpmTasks('grunt-saucelabs-qunit');
	grunt.loadNpmTasks('grunt-node-qunit');
	
	grunt.registerTask("build", "concat min");
	grunt.registerTask("test", "build server cors-server node-qunit saucelabs-qunit publish-results");
	
	grunt.registerTask('default', 'build');
};
