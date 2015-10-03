global.testUtils = require('./utils.js');
var chai = require('chai');
chai.use(require('chai-as-promised'));
global.should = chai.should();

require('./test.basics');
