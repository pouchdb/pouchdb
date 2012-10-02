/*!
 * Soda - Client
 * Copyright(c) 2010 LearnBoost <tj@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var http = require('http')
  , qs = require('querystring')
  , EventEmitter = require('events').EventEmitter;

/**
 * Initialize a `Client` with the given `options`.
 * 
 * Options:
 *   
 *   - `host`     Hostname defaulting to localhost
 *   - `port`     Port number defaulting to 4444
 *   - `browser`  Browser name
 *   - `url`      URL string
 * 
 * @params {Object} options
 * @api public
 */

var Client = exports = module.exports = function Client(options) {
  this.host = options.host || 'localhost';
  this.port = options.port || 4444;
  this.browser = options.browser || 'firefox';
  this.url = options.url;

  // Allow optional "*" prefix
  if (this.browser[0] !== '*') {
    this.browser = '*' + this.browser;
  }

  EventEmitter.call(this);
};

/**
 * Interit from `EventEmitter`.
 */

Client.prototype.__proto__ = EventEmitter.prototype;

/**
 * Initialize a new session, then callback `fn(err, sid)`
 *
 * @param {Function} fn
 * @return {Client}
 * @api public
 */

Client.prototype.session = function(fn){
  var self = this;
  if (!this.browser) throw new Error('browser required');
  if (!this.url) throw new Error('browser url required');
  if (this.queue) {
    return this.enqueue('getNewBrowserSession', [this.browser, this.url], function(body){
      self.sid = body;
    });
  } else {
    this.command('getNewBrowserSession', [this.browser, this.url], function(err, body){
      if (err) return fn(err);
      fn(null, self.sid = body);
    });
  }
};

/**
 * Execute the given `cmd` / `args`, then callback `fn(err, body, res)`.
 *
 * @param {String} cmd
 * @param {Array} args
 * @param {Function} fn
 * @return {Client} for chaining
 * @api private
 */

Client.prototype.command = function(cmd, args, fn){
  this.emit('command', cmd, args);

  // HTTP client
  var client = http.createClient(this.port, this.host);

  // Path construction
  var path = this.commandPath(cmd, args);

  var req;
  
  // Selenium RC can support POST request: http://svn.openqa.org/fisheye/changelog/selenium-rc/?cs=1898,    
  // we need to switch to use POST if the URL's is too long (Below I use the Internet Explorer's limit).
  // See also: http://jira.openqa.org/browse/SRC-50
  if (path.length > 2048 && (this.host + path ).length > 2083) {
    postData = this.commandPath(cmd, args).replace('/selenium-server/driver/?', "");
    req = client.request('POST'
    , path
    , { Host: this.host + (this.port ? ':' + this.port : '') 
        , 'Content-Length': postData.length
        , 'Content-Type': 'application/x-www-form-urlencoded'
    });
    
    req.write(postData);
  } else {    
    req = client.request('GET'
    , path
    , { Host: this.host + (this.port ? ':' + this.port : '') });    
  }
  
  req.on('response', function(res){
    res.body = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk){ res.body += chunk; });
    res.on('end', function(){
      if (res.body.indexOf('ERROR') === 0 ||
          res.body.indexOf('Timed out after ') === 0) {
        var err = res.body.replace(/^ERROR: */, '');
        err = cmd + '(' + args.join(', ') + '): ' + err; 
        fn(new Error(err), res.body, res);
      } else {
        if (res.body.indexOf('OK') === 0) {
          res.body = res.body.replace(/^OK,?/, '');
        }
        fn(null, res.body, res);
      }
    });
  });
  req.end();
  return this;
};

/**
 * Construct a `cmd` path with the given `args`.
 *
 * @param {String} name
 * @param {Array} args
 * @return {String}
 * @api private
 */

Client.prototype.commandPath = function(cmd, args){
  var obj = { cmd: cmd };

  // Arguments by nth
  if (args) {
    args.forEach(function(arg, i){
      obj[i+1] = arg;
    });
  }
  // Ignore session id for getNewBrowserSession
  if (this.sid && cmd !== 'getNewBrowserSession') {
    obj.sessionId = this.sid;
  }

  return '/selenium-server/driver/?' + qs.stringify(obj);
};

/**
 * Indicate that commands should be queued.
 *
 * Example:
 *
 *      browser
 *        .chain
 *        .session()
 *        .open('/')
 *        .type('q', 'Hello World')
 *        .clickAndWait('btnG')
 *        .assertTitle('Hello World - Google')
 *        .testComplete()
 *        .end(function(err){ ... });
 *
 * @api public
 */

Client.prototype.__defineGetter__('chain', function(){
  this.queue = [];
  return this;
});

/**
 * Callback `fn(err)` when the queue is complete, or
 * when an exception has occurred.
 *
 * @param {Function} fn
 * @api public
 */

Client.prototype.end = function(fn){
  this._done = function(){this.queue = null; return fn.apply(this, arguments)};
  this.queue.shift()();
};

/**
 * Enqueue the given `cmd` and array of `args` for execution.
 *
 * @param {String} cmd
 * @param {Array} args
 * @return {Client}
 * @api private
 */

Client.prototype.enqueue = function(cmd, args, fn){
  var self = this
    , len = args.length;

  // Indirect callback support
  if (typeof args[len - 1] === 'function') {
    fn = args.pop();
  }

  this.queue.push(function(){
    self.command(cmd, args, function(err, body, res){
      // Callback support
      if (!err && fn) {
        try {
          fn(body, res);
        } catch (err) {
          return self._done(err, body, res);
        }
      }

      if (err) {
        self._done(err, body, res);
      } else if (self.queue.length) {
        self.queue.shift()();
      } else {
        self._done(null, body, res);
      }
    });
  });
  return this;
};

/**
 * Arbitrary callback `fn(this)` when using the chaining api.
 *
 * @param {Function} fn
 * @return {Client}
 * @api public
 */

Client.prototype.and = function(fn){
  fn.call(this, this);
  return this;
};

/**
 * Shortcut for `new soda.Client()`.
 *
 * @param {Object} options
 * @return {Client}
 * @api public
 */

exports.createClient = function(options){
  return new Client(options);
};

/**
 * Command names.
 * 
 * @type Array
 */

exports.commands = [
  // rc
    'getNewBrowserSession'
  , 'setContext'
  , 'testComplete'
  // selenium actions
  , 'addLocationStrategy'
  , 'addScript'
  , 'addSelection'
  , 'allowNativeXpath'
  , 'altKeyDown'
  , 'altKeyUp'
  , 'answerOnNextPrompt'
  , 'assignId'
  , 'break'
  , 'captureEntirePageScreenshot'
  , 'captureNetworkTraffic'
  , 'check'
  , 'chooseCancelOnNextConfirmation'
  , 'chooseOkOnNextConfirmation'
  , 'click'
  , 'clickAndWait'
  , 'clickAt'
  , 'clickAtAndWait'
  , 'close'
  , 'contextMenu'
  , 'contextMenuAt'
  , 'controlKeyDown'
  , 'controlKeyUp'
  , 'createCookie'
  , 'deleteAllVisibleCookies'
  , 'deleteCookie'
  , 'deselectPopUp'
  , 'doubleClick'
  , 'doubleClickAt'
  , 'dragAndDrop'
  , 'dragAndDropToObject'
  , 'echo'
  , 'fireEvent'
  , 'focus'
  , 'goBack'
  , 'highlight'
  , 'ignoreAttributesWithoutValue'
  , 'keyDown'
  , 'keyPress'
  , 'keyUp'
  , 'metaKeyDown'
  , 'metaKeyUp'
  , 'mouseDown'
  , 'mouseDownAt'
  , 'mouseDownRight'
  , 'mouseDownRightAt'
  , 'mouseMove'
  , 'mouseMoveAt'
  , 'mouseOut'
  , 'mouseOver'
  , 'mouseUp'
  , 'mouseUpAt'
  , 'mouseUpRight'
  , 'mouseUpRightAt'
  , 'open'
  , 'openWindow'
  , 'refresh'
  , 'removeAllSelections'
  , 'removeScript'
  , 'removeSelection'
  , 'rollup'
  , 'runScript'
  , 'select'
  , 'selectAndWait'
  , 'selectFrame'
  , 'selectPopUp'
  , 'selectWindow'
  , 'setBrowserLogLevel'
  , 'setCursorPosition'
  , 'setMouseSpeed'
  , 'setSpeed'
  , 'setTimeout'
  , 'shiftKeyDown'
  , 'shiftKeyUp'
  , 'submit'
  , 'type'
  , 'typeKeys'
  , 'uncheck'
  , 'useXpathLibrary'
  , 'waitForCondition'
  , 'waitForFrameToLoad'
  , 'waitForPageToLoad'
  , 'waitForPopUp'
  , 'windowFocus'
  , 'windowMaximize'
  , 'captureScreenshotToString'
];

/**
 * Accessor names.
 * 
 * @type Array
 */

exports.accessors = [
    'ErrorOnNext'
  , 'FailureOnNext'
  , 'Alert'
  , 'AllButtons'
  , 'AllFields'
  , 'AllLinks'
  , 'AllWindowIds'
  , 'AllWindowNames'
  , 'AllWindowTitles'
  , 'Attribute'
  , 'AttributeFromAllWindows'
  , 'BodyText'
  , 'Confirmation'
  , 'Cookie'
  , 'CookieByName'
  , 'CursorPosition'
  , 'ElementHeight'
  , 'ElementIndex'
  , 'ElementPositionLeft'
  , 'ElementPositionTop'
  , 'ElementWidth'
  , 'Eval'
  , 'Expression'
  , 'HtmlSource'
  , 'Location'
  , 'LogMessages'
  , 'MouseSpeed'
  , 'Prompt'
  , 'SelectedId'
  , 'SelectedIds'
  , 'SelectedIndex'
  , 'SelectedIndexes'
  , 'SelectedLabel'
  , 'SelectedLabels'
  , 'SelectedValue'
  , 'SelectedValues'
  , 'SelectOptions'
  , 'Speed'
  , 'Table'
  , 'Text'
  , 'Title'
  , 'Value'
  , 'WhetherThisFrameMatchFrameExpression'
  , 'WhetherThisWindowMatchWindowExpression'
  , 'XpathCount'
  , 'AlertPresent'
  , 'Checked'
  , 'ConfirmationPresent'
  , 'CookiePresent'
  , 'Editable'
  , 'ElementPresent'
  , 'ElementNotPresent'
  , 'Ordered'
  , 'PromptPresent'
  , 'SomethingSelected'
  , 'TextPresent'
  , 'Visible'
];

/**
 * Generate commands via accessors.
 * 
 * All accessors get prefixed with:
 *
 *  - get
 *  - assert
 *  - assertNot
 *  - verify
 *  - verifyNot
 *  - waitFor
 *  - waitForNot
 *
 * For example providing us with:
 *
 *  - getTitle
 *  - assertTitle
 *  - verifyTitle
 *  - ...
 *
 */

exports.accessors.map(function(cmd){
  exports.commands.push(
      'get' + cmd
    , 'assert' + cmd
    , 'assertNot' + cmd
    , 'store' + cmd
    , 'verify' + cmd
    , 'verifyNot' + cmd
    , 'waitFor' + cmd
    , 'waitForNot' + cmd);
});

/**
 * Generate command methods.
 */

exports.commands.map(function(cmd){
  Client.prototype[cmd] = function(){
    // Queue the command invocation
    if (this.queue) {
      var args = Array.prototype.slice.call(arguments);
      return this.enqueue(cmd, args);
    // Direct call
    } else {
      var len = arguments.length
        , fn = arguments[len - 1]
        , args = Array.prototype.slice.call(arguments, 0, len - 1);
      return this.command(cmd, args, fn);
    }
  };
});
