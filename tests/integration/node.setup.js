// throw an error if any EventEmitter adds too many listeners
import 'throw-max-listeners-error';

import seedrandom from 'seedrandom';
const seed = (process.env.SEED || Date.now()) + "";
console.log('Seeded with: ' + seed);
seedrandom(seed, { global: true });

const testsDir = process.env.TESTS_DIR || './tmp';
import { exec } from 'node:child_process';
function cleanup() {
  // Remove test databases
  exec('rm -r ' + testsDir);
}
exec('mkdir -p ' + testsDir, function () {
  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);
});
import utils from './utils.js';
global.testUtils = utils;
global.PouchDB = testUtils.loadPouchDB();
import chai from 'chai';
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
global.should = chai.should();
global.assert = chai.assert;
import fs from 'node:fs';
global.fs = fs;
global.fs.mkdirSync('./tmp', { recursive: true });
