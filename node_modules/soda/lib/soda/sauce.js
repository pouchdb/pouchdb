/*!
 * Soda - Sauce
 * Copyright(c) 2010 LearnBoost <tj@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Client = require('./client');

/**
 * Initialize a `SauceClient` with the given `options`. A suite of environment
 * variables are also supported in place of the options described below.
 * 
 * Options:
 *   
 *   - `username`         Sauce Labs username
 *   - `access-key`       Account access key
 *   - `os`               Operating system ex "Linux"
 *   - `browser`          Browser name, ex "firefox"
 *   - `browser-version`  Browser version, ex "3.0.", "7."
 *   - `max-duration`     Maximum test duration in seconds, ex 300 (5 minutes)
 * 
 * Environment Variables:
 * 
 *   - `SAUCE_HOST`   Defaulting to "ondemand.saucelabs.com"
 *   - `SAUCE_PORT`   Defaulting to 80
 *   - `SAUCE_OS`
 *   - `SAUCE_BROWSER`
 *   - `SAUCE_USERNAME`
 *   - `SAUCE_ACCESS_KEY`
 *   - `SAUCE_BROWSER_VERSION`
 * 
 * @params {Object} options
 * @api public
 */

var SauceClient = exports = module.exports = function SauceClient(options) {
  options = options || {};
  this.host = process.env.SAUCE_HOST || 'ondemand.saucelabs.com';
  this.port = process.env.SAUCE_PORT || 80;
  
  // Check sauce env variables, and provide defaults
  options.os = options.os || process.env.SAUCE_OS || 'Linux';
  options.url = options.url || process.env.SAUCE_BROWSER_URL;
  options.browser = options.browser || process.env.SAUCE_BROWSER || 'firefox';
  options.username = options.username || process.env.SAUCE_USERNAME;
  options['access-key'] = options['access-key'] || process.env.SAUCE_ACCESS_KEY;
  
  // Allow users to specify an empty browser-version
  options['browser-version'] = options['browser-version'] == undefined
    ? (process.env.SAUCE_BROWSER_VERSION || '')
    : (options['browser-version'] || '');

  this.url = options.url;
  this.username = options.username;
  this.accessKey = options['access-key'];
  this.options = options;
  this.browser = JSON.stringify(options);
};

/**
 * Interit from `Client`.
 */

SauceClient.prototype.__proto__ = Client.prototype;

/**
 * Return saucelabs job url.
 *
 * @return {String}
 * @api public
 */

SauceClient.prototype.__defineGetter__('jobUrl', function(){
  return 'https://saucelabs.com/jobs/' + this.sid;
});
/**
 * Return saucelabs video flv url.
 *
 * @return {String}
 * @api public
 */

SauceClient.prototype.__defineGetter__('videoUrl', function(){
  return exports.url(this.username, this.sid, 'video.flv');
});

/**
 * Return saucelabs log file url.
 *
 * @return {String}
 * @api public
 */

SauceClient.prototype.__defineGetter__('logUrl', function(){
  return exports.url(this.username, this.sid, 'selenium-server.log');
});

/**
 * Return saucelabs video embed script.
 *
 * @return {String}
 * @api public
 */

SauceClient.prototype.__defineGetter__('video', function(){
  return exports.video(this.username, this.accessKey, this.sid);
});

/**
 * Shortcut for `new soda.SauceClient()`.
 *
 * @param {Object} options
 * @return {Client}
 * @api public
 */

exports.createClient = function(options){
  return new SauceClient(options);
};

/**
 * Return saucelabs url to `jobId`'s `filename`.
 *
 * @param {String} username
 * @param {String} jobId
 * @param {String} filename
 * @return {String}
 * @api public
 */

exports.url = function(username, jobId, filename){
  return 'https://saucelabs.com/rest/'
    + username + '/jobs/'
    + jobId + '/results/'
    + filename;
};

/**
 * Return saucelabs video embed script. 
 *
 * @param {String} username
 * @param {String} accessKey
 * @param {String} jobId
 * @return {String}
 * @api public
 */

exports.video = function(username, accessKey, jobId){
  return '<script src="http://saucelabs.com/video-embed/'
    + jobId + '.js?username='
    + username + '&access_key='
    + accessKey + '"/>';
};
