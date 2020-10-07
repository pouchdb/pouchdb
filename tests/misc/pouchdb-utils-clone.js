'use strict';

const utils = require('../../packages/node_modules/pouchdb-utils');
let object1 = {
  name: 'one',
  number: 1,
  date: new Date('2020-10-05')
};
let object2 = {
  name: 'two',
  number: 2,
  date: new Date('0000-00-00')
};

// prev condition
console.log('prev condition');
console.log({ object1_instanceof_date: object1.date instanceof Date });
console.log({ object2_instanceof_date: object2.date instanceof Date });

// result without condition
console.log('result without condition');
console.log({ object1_toISOString: object1.date.toISOString() });
try {
  console.log({ object2_toISOString: object2.date.toISOString() });
} catch (err) {
  console.log({ object2_toISOString: [err.name, err.message] });
}

// new condition
console.log('new condition');
console.log({ object1_instanceof_date: object1.date instanceof Date && isFinite(object1.date) });
console.log({ object2_instanceof_date: object2.date instanceof Date && isFinite(object2.date) });

console.log('cloning');
let object1Clone = utils.clone(object1);
console.log({ object1Clone: object1Clone });

try {
  let object2Clone = utils.clone(object2);
  console.log({ object2Clone: object2Clone });
} catch (err) {
  console.log({ object2Clone: [err.name, err.message] });
}

console.log('cloning without error handling');
let object2BClone = utils.clone(object2);
console.log({ object2BClone: object2BClone });
