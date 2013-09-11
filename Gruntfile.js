/*jshint node: true */

var url = require('url');
var fs = require('fs');
var cp = require('child_process');

var nano = require('nano');
var cors_proxy = require("corsproxy");
var http_proxy = require("http-proxy");

var browserConfig = [{
  browserName: 'firefox',
  version: '19',
  platform: 'Linux',
  name: 'linux/firefox'
},{
  browserName: 'chrome',
  platform: 'Windows 8',
  name: 'chrome/firefox'
}];

var fileHeader = '// <%= pkg.name %>.<%= pkg.release %> - ' +
  '<%= grunt.template.today("isoDateTime") %>\n';

module.exports = function(grunt) {

  var testStartTime = new Date();
  var testResults = {};
  var buildName = '-nightly';

  var adapters = grunt.option('adapters') || ['http', 'idb', 'websql'];
  if (typeof adapters === 'string') {
    adapters = adapters.split(/[\s,]+/);
    buildName = '-' + adapters.join('-') + buildName;
  }

  var plugins = grunt.option('plugins') || ['mapreduce'];
  if (typeof plugins === 'string') {
    plugins = plugins.split(/[\s,]+/);
    buildName = '.' + plugins.join('-') + buildName;
  }

  function stripName(name) {
    return name.replace(/(.+\.)?(\w+)\.js$/, function(match, $1, $2) {
      return $2;
    });
  }

  var allAdapters = fs.readdirSync('./src/adapters').map(stripName);
  var allPlugins = fs.readdirSync('./src/plugins').map(stripName);
  var allModules = allAdapters.concat(allPlugins);
  var modules = adapters.concat(plugins);

  var excludedTests = ['auth_replication', 'cors'];
  allModules.forEach(function(module) {
    if (modules.indexOf(module) === -1) {
      excludedTests.push(module);
    }
  });
  excludedTests = excludedTests.map(function (module) {
    return 'test.' + module + '.js';
  });

  var testFiles = fs.readdirSync("./tests").filter(function(name){
    return (/^test\.([a-z0-9_])*\.js$/).test(name) &&
      (excludedTests.indexOf(name) === -1);
  });

  var srcFiles = [
    "src/pouch.js", "src/pouch.collate.js", "src/pouch.merge.js",
    "src/pouch.replicate.js", "src/pouch.utils.js", "src/pouch.adapter.js"
  ];

  adapters.map(function(adapter) {
    srcFiles.push("src/adapters/pouch." + adapter + ".js");
  });

  plugins.map(function(plugin) {
    srcFiles.push("src/plugins/pouchdb." + plugin + ".js");
  });

  grunt.initConfig({

    'pkg': grunt.file.readJSON('package.json'),

    'clean': {
      build : ["./dist"],
      "node-qunit": ["./testdb_*"]
    },

    'concat': {
      options: {
        banner: fileHeader + '\n(function() {\n ',
        footer: '\n })(this);'
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
        dest: 'dist/pouchdb.amd' + buildName + '.js'
      },
      all: {
        src: grunt.util._.flatten([
          "src/deps/uuid.js", "src/deps/md5.js",
          "src/deps/polyfill.js", "src/deps/extend.js","src/deps/ajax.js", srcFiles
        ]),
        dest: 'dist/pouchdb' + buildName + '.js'
      },
    },

    'uglify': {
      options: {
        banner: fileHeader
      },
      dist: {
        src: './dist/pouchdb' + buildName + '.js',
        dest: 'dist/pouchdb' + buildName + '.min.js'
      },
    },

    // Servers
    'connect' : {
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
      files: [
        'src/adapters/*.js',
        'tests/*.js',
        'src/*.js',
        'src/plugins/pouchdb.gql.js'
      ],
      options : {
        jshintrc: '.jshintrc'
      }
    },

    'node-qunit': {
      all: {
        deps: ['./src/deps/extend.js','./src/deps/ajax.js','./src/pouch.js'],
        code: './src/adapters/pouch.leveldb.js',
        tests: (function() {
          var testFilesToRun = testFiles;

          // takes in an optional --test=<regex> flag
          // to allow running specific test files
          var testFileRegex = grunt.option('test');
          if (testFileRegex) {
            testFilesToRun = testFilesToRun.filter(function (n) {
              return new RegExp(testFileRegex, "i").test(n);
            });
          }
          return testFilesToRun.map(function (n) {
            return "./tests/" + n;
          });
        })(),
        done: function(err, res) {
          !err && (testResults['node'] = res);
          return true;
        }
      }
    },

    'saucelabs-qunit': {
      all: {
        options: {
          username: 'pouchdb',
          key: '97de9ee0-2712-49f0-9b17-4b9751d79073',
          tags: [process.env.TRAVIS_BRANCH || "unknown"],
          testTimeout: 1000 * 60 * 15, // 15 minutes
          testInterval: 1000 * 30, // 30 seconds
          tunnelTimeout: 1000 * 60 * 15, // 15 minutes
          urls: ["http://127.0.0.1:8000/tests/test.html?test=release-min&id=" +
                 testStartTime.getTime() + "&scroll=true&testFiles=" +
                 testFiles.join(',')],
          browsers: browserConfig,
          detailedError : true,
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
      }
    },
    'publish-results': {
      server: 'http://couchdb.pouchdb.com',
      db: 'test_results'
    }
  });

  // Custom tasks
  grunt.registerTask("forever", 'Runs forever', function(){
    console.log("Visit http://127.0.0.1:8000/tests/test.html " +
                "in your browser to run tests.");
    this.async();
  });

  grunt.registerTask("cors-server", "Runs a CORS proxy", function(){
    var corsPort = arguments[0] || grunt.config("cors-server.port");
    var couchUrl = grunt.option('couch-host') || grunt.config("cors-server.base");
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
        .insert(results, testStartTime.getTime() + "", function(err, body) {
          var url = grunt.config("publish-results.server") +
            '/_utils/document.html?' + grunt.config("publish-results.db") +
            '/' + testStartTime.getTime();
          console.log('View test output:'.yellow, url);
          done(results.passed && err === null);
        });
    });
  });

  if (grunt.option('couch-host')) {
    process.env.COUCH_HOST = grunt.option('couch-host');
  }

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
  grunt.registerTask("browser", ["connect", "cors-server", "forever"]);
  grunt.registerTask("full", ["concat", "uglify"]);

  grunt.registerTask("spatial", function() {
    grunt.warn(
      'This task is no longer supported. Use `grunt --plugins=spatial` instead.'
    );
  });
  grunt.registerTask("gql", function() {
    grunt.warn(
      'This task is no longer supported. Use `grunt --plugins=gql` instead.'
    );
  });

  grunt.registerTask("test", ["jshint", "node-qunit"]);
  grunt.registerTask("test-travis", ["jshint", "build", "connect", "cors-server",
                                     "node-qunit", "saucelabs-qunit",
                                     "publish-results"]);

  grunt.registerTask('default', 'build');
};
