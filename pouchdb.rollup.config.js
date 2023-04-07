// Build should have the following flow
// We try to build all ESM Modules keep Node external
// Then we maybe apply other hacks
// Then we maybe build umd out of that.


// todo
// Remove instances of require and module.exports by bundling into a single chunk
// Go from CommonJS to something that browser understands
// Resolve imports to NodeJS exclusives to browser alternatives
// Allow JSON imports/requires translate to import('./*.json',{assert:{type:'json'}})
// Resolution of bare imports to NPM modules (node_modules folder)
// Replace global process with NPM module process as a shim
import consumers from 'node:stream/consumers'
// Browserify Rollup
const BROWSERIFY_ALIASES = {
    assert: 'assert',
    events: 'events',
    fs: 'memfs',
    module: EMPTY_MODULE_ID,
    path: 'path-browserify',
    process: 'process',
    util: 'util',
};
 
const browserPlugins = [
    commonjs(), 
    {name: 'browserify',
    async resolveId(source, importer) {
        return (source in BROWSERIFY_ALIASES)
            ? (BROWSERIFY_ALIASES[source] === EMPTY_MODULE_ID) 
                ? EMPTY_MODULE_ID 
                : nodeResolve.resolveId(BROWSERIFY_ALIASES[source], undefined)
            : source === EMPTY_MODULE_ID ? EMPTY_MODULE_ID : null;
    },
    load(id) {
        if (id === EMPTY_MODULE_ID) {
            return EMPTY_MODULE;
        }
    }},
    inject({ process: 'process' }),
    nodeResolve({
        preferBuiltins: false,
        mainFields: ['module', 'jsnext:main', 'browser'],
    }),
    json(),
    // {name: 'inline-fs',
    //     transform(code, id) {
    //       return code.replace(
    //         /fs.readFileSync\(\s*__dirname\s*\+\s*'\/templates\/(.*)'\)/g,
    //         (match, $1) => {
    //           return JSON.stringify(fs.readFileSync(path.join('./node_modules/browser-style-dictionary/lib/common/templates',$1 ), 'utf8'));
    //         }
    //       );
    //     },
    //   },
    // {name: 'remove-glob-weirdness',
    //     renderChunk(code) {
    //       return code.replace(/glob_1\.Glob;/g, '');
    //     }
    // }
];

  

// TODO: Switch complet to rollup
// this build modules
import('node:path').then((path)=>import('node:fs').then(async ({promises:{stat,readdir:readDir}}) => 
Promise.all(await readDir('packages/node_modules').map(async (pkg) => {
  const nodeModulesPath = path.resolve('packages/node_modules', pkg);
  return (await stat(nodeModulesPath)).isDirectory() && console.log(`Building ${pkg}...`) || (pkg === 'pouchdb') 
    ? import('./build-pouchdb').then(({ default: buildPouchDB })=>buildPouchDB())
    : buildModule(nodeModulesPath); 
})))).catch(({stack}) => {
    console.error('build error');
    console.error(stack);
    process.exit(1);
})


import path from 'node:path';
import denodeify from 'denodeify';
import fs from 'node:fs';
const writeFileAsync = denodeify(fs.writeFile);
const renameAsync = denodeify(fs.rename);

import terser from "terser";

function addPath(pkgName, otherPath) {
  return path.resolve(`packages/node_modules/${pkgName}`, otherPath);
}

function writeFile(filename, contents) {
  const tmp = `${filename}.tmp`;
  return writeFileAsync(tmp, contents, 'utf-8').then(() => renameAsync(tmp, filename)).then(() => {
    console.log(`  \u2713 wrote ${filename.match(/packages[/\\]node_modules[/\\]\S*?[/\\].*/)[0]}`);
  });
}

function doUglify(pkgName, code, prepend, fileOut) {
  const miniCode = prepend + terser.minify(code).code;
  return writeFile(addPath(pkgName, fileOut), miniCode);
}

export {addPath};

export {doUglify};
export {writeFile};

// Build PouchDB
import path from 'path';
import denodeify from 'denodeify';
import rollup from 'rollup';

const addPath = buildUtils.addPath;
const doUglify = buildUtils.doUglify;
const doBrowserify = buildUtils.doBrowserify;
const writeFile = buildUtils.writeFile;

import pkg from '../packages/node_modules/pouchdb/package.json' assert { type: 'json' };
const version = pkg.version;

import builtInModules from 'builtin-modules';
const external = Object.keys(require('../package.json').dependencies)
  .concat(builtInModules);



const currentYear = new Date().getFullYear();



const rimrafMkdirp = (...args) => Promise.all(args.map(otherPath => rimraf(path.resolve(`packages/node_modules/${'pouchdb'}`, otherPath)))).then(() => Promise.all(args.map(otherPath => mkdirp(addPath('pouchdb', otherPath)))));

async function doBuildAll() {
    const comments = {
        'pouchdb': `// PouchDB ${version}\n// \n// (c) 2023-${currentYear} The PouchDB Contributors\n// PouchDB may be freely distributed under the Apache license, version 2.0 or The Unlicense.\n// For all details and documentation:\n// http://pouchdb.com\n`,
        'awesome-os': '// The Awesome OS Integration is Sponsored by Frank Lemanschik https://github.com/lemanschik',
        'indexeddb': `// PouchDB indexeddb plugin ${version}\n`,
        'memory': `// PouchDB in-memory plugin ${version}\n// Based on MemDOWN: https://github.com/rvagg/memdown\n// \n// (c) 2012-${currentYear} Dale Harvey and the PouchDB team\n// PouchDB may be freely distributed under the Apache license, version 2.0.\n// For all details and documentation:\n// http://pouchdb.com\n`,
        'localstorage': `// PouchDB localStorage plugin ${version}\n// Based on localstorage-down: https://github.com/No9/localstorage-down\n// \n// (c) 2012-${currentYear} Dale Harvey and the PouchDB team\n// PouchDB may be freely distributed under the Apache license, version 2.0.\n// For all details and documentation:\n// http://pouchdb.com\n`,
        'find': `// pouchdb-find plugin ${version}\n// Based on Mango: https://github.com/cloudant/mango\n// \n// (c) 2012-${currentYear} Dale Harvey and the PouchDB team\n// PouchDB may be freely distributed under the Apache license, version 2.0.\n// For all details and documentation:\n// http://pouchdb.com\n`,
      };
    return rimrafMkdirp('lib', 'dist', 'lib/plugins')
    .then(Promise.all([

        // Node
        mkdirp(addPath('pouchdb', 'lib/plugins')).then(doRollup('src/index.js', false, {
            cjs: 'lib/index.js',
            es: 'lib/index.es.js'
        })), 

        // Browser
        doRollup('src/index.js', true, { cjs: 'lib/index-browser.js', es: 'lib/index-browser.es.js' }),
        await doBrowserify('pouchdb', 'lib/index-browser.js', {standalone:'PouchDB'}).then(code => [
        writeFile(addPath('pouchdb', 'dist/pouchdb.js'), comments.pouchdb + code),
        doUglify('pouchdb', comments.pouchdb + code, comments.pouchdb, 'dist/pouchdb.min.js')]),
        ['indexeddb', 'localstorage', 'memory', 'find'].map(async (plugin)=>{
            await doRollup(`src/plugins/${plugin}.js`, true, { cjs: `lib/plugins/${plugin}.js` }) 
            const source = `lib/plugins/${plugin}.js`;
            await doBrowserify('pouchdb', source, {}, 'pouchdb').then(code => {
                  return Promise.all([
                    writeFile(`packages/node_modules/pouchdb/dist/pouchdb.${plugin}.js`, comments[plugin] + code),
                    doUglify('pouchdb', comments[plugin] + code, comments[plugin], `dist/pouchdb.${plugin}.min.js`)
                  ]);
                })
            // no need for this after building dist/
            rimraf(addPath('pouchdb', 'lib/plugins'))
        })
    ].flaten()));
}






// This is build module
import CommonJS from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import inject from '@rollup/plugin-inject';
import {rollup} from 'rollup';
import path from 'node:path';
// var denodeify = require('denodeify'); is Promisify()
const mkdirp = denodeify(require('mkdirp'));
const rimraf = denodeify(require('rimraf'));
import builtInModules from 'builtin-modules';
import fs from 'node:fs';

async function buildModule(filepath) {
const [pkg,topPkg] = ['package.json', '../../../package.json'].map((pathname)=>path.resolve(filepath,pathname));
const pouchdbPackages = fs.readdirSync(path.resolve(filepath, '..'));

// browser & node vs one single vanilla version
const versions = pkg.browser ? [false, true] : [false];

// technically this is necessary in source code because browserify
// needs to know about the browser switches in the lib/ folder
// some modules don't need this check and should be skipped
// packages that only use the browser field to ignore dependencies
if (!(['pouchdb-adapter-leveldb'].includes(pkg.name)) && pkg.browser && pkg.browser['./lib/index.js'] !==
    './lib/index-browser.js') {
    new Error(`${pkg.name} is missing a "lib/index.js" entry in the browser field`);
}
// All external modules are assumed to be CommonJS, and therefore should be skipped by Rollup. We may revisit this later.
const rollupSkipExternalDepsBecauseCJS = Object.keys(topPkg.dependencies || {})
.concat(builtInModules,
// special case - pouchdb-for-coverage is heavily optimized because it's
// simpler to run the coverage reports that way.
// as for pouchdb-node/pouchdb-browser, these are heavily optimized
// through aggressive bundling, ala pouchdb, because it's assumed that
// for these packages bundle size is more important than modular deduping    
!['pouchdb-for-coverage', 'pouchdb-node', 'pouchdb-browser'].includes(pkg.name) && pouchdbPackages);


        // Node
const rollupConfigNode =        mkdirp(addPath('pouchdb', 'lib/plugins')).then(doRollup('src/index.js', false, {
            cjs: 'lib/index.js',
            es: 'lib/index.es.js'
        })), 


Promise.resolve().then(async () => {
(await rimraf(path.resolve(filepath, 'lib'))) && mkdirp(path.resolve(filepath, 'lib'));
}).then(() => Promise.all(versions.map(isBrowser => rollup({
input: path.resolve(filepath, './src/index.js'),
external: rollupSkipExternalDepsBecauseCJS,
plugins: [
    // special case for "pouchdb-browser" - there is only one index.js,
    // and it's built in "browser mode"
    nodeResolve({ 
        main: false, // don't use "main"s that are CJS for PouchDB Standalone build only maybe
        jsnext: true, browser: isBrowser || ['pouchdb-browser'].includes(pkg.name) }),
    replace({
        // we have switches for coverage; don't ship this to consumers
        'process.env.COVERAGE': JSON.stringify(!!process.env.COVERAGE),
        // test for fetch vs xhr
        'process.env.FETCH': JSON.stringify(!!process.env.FETCH)
    }),
    // we should try to build without that.
    inject({
        exclude: [
        '**/pouchdb-utils/src/assign.js',
        '**/pouchdb-collections/src/**'
        ],
        Map: ['pouchdb-collections', 'Map'],
        Set: ['pouchdb-collections', 'Set'],
    })
    ]
}).then(bundle => {
    const formats = ['cjs', 'es'];
    return Promise.all(formats.map(format => {
      const file = (isBrowser ? 'lib/index-browser' : 'lib/index') +
        (format === 'es' ? '.es.js' : '.js');
      return bundle.write({
        format,
        file: path.resolve(filepath, file)
      }).then(() => {
        console.log(`  \u2713 wrote ${path.basename(filepath)}/${file} in ${isBrowser ? 'browser' :
    versions.length > 1 ? 'node' : 'vanilla'} mode`);
      });
    }));
  }))));
}

// if (require.main === module) {
//   buildModule(process.argv[process.argv.length - 1]).catch(({stack}) => {
//     console.error('build-module.js error');
//     console.error(stack);
//     process.exit(1);
//   });
// } else {
//   module.exports = buildModule;
// }

const esm = {};
const umd = {};

export default [esm,umd]
