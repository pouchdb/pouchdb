'use strict';

require('chai').should();
var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
var extend = PouchDB.utils.jsExtend;

describe('test.jsExtend.js', function () {

  it('Test one level merging', function () {
    var obj1 = { name: 'Jonny' }
		, obj2 = { lastName: 'Quest' };

	extend(obj1, obj2);

	obj1.name.should.equal('Jonny');
    obj1.lastName.should.equal('Quest');
  });

  it('Test two levels merging', function () {
    var obj1 = { sub: { firstValue: 1 } }
		, obj2 = { sub: { secondValue: 2 } };

	extend(obj1, obj2);

	obj1.sub.firstValue.should.equal(1);
    obj1.sub.secondValue.should.be.equal(2);
  });

  it('Test multilevel merging', function () {
    var obj1 = { 
		name: 'Jonny', 
		sub: { 
			firstValue: 1 
		} 
	}
	, obj2 = { 
		lastName: 'Quest', 
		sub: { 
			secondValue: 2 
		}, 
		sub2: { 
			thirdSub: { 
				thirdValue: 3
			} 
		} 
	};

	extend(obj1, obj2);

	obj1.name.should.equal('Jonny');
	obj1.lastName.should.equal('Quest');
	obj1.sub.firstValue.should.equal(1);
	obj1.sub.secondValue.should.equal(2);
    obj1.sub2.thirdSub.thirdValue.should.equal(3);
  });

  it('Test passing multiple ojects as arguments', function () {
	var obj1 = { name: 'Jonny' }
		, obj2 = { lastName: 'Quest' }
		, obj3 = { father: 'Benton' };

	extend(obj1, obj2, obj3);

	obj1.name.should.equal('Jonny');
	obj1.lastName.should.equal('Quest');
	obj1.father.should.equal('Benton');

  });

  it('Test if non object argument raises exception', function () {
    (function () {
		extend('string', {});
    }).should.throw('string is not an object');
  });
});
