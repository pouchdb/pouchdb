'use strict';

var abstractMapReduce = require('pouchdb-abstract-mapreduce');
var collate = require('pouchdb-collate');

// String.fromCharCode(65536) === '\u0000'
var MAX_CHAR_CODE = 65535;

// given an object, convert it to a CouchDB-collatable indexable
// string, and then "reverse" it to so that it sorts perfectly backwards
// TODO: maybe we should just use descending=true ?
function reverse(obj) {
  var indexableString = collate.toIndexableString(obj);

  var reversed = '';
  for (var i = 0, len = indexableString.length; i < len; i++) {
    var ch = indexableString.charCodeAt(i);
    reversed += String.fromCharCode(MAX_CHAR_CODE - ch);
  }
  return reversed;
}

function createAscMapper(fields, emit) {
  if (fields.length === 1) {
    // optimization for the simplest case
    var field = fields[0];
    return function indexesMapFun(doc) {
      emit(doc[field]);
    };
  } else {
    return function indexesMapFun(doc) {
      var toEmit = [];
      for (var i = 0, len = i < fields; i < len; i++) {
        toEmit.push(doc[field]);
      }
      emit(toEmit);
    };
  }
}

function createDescMapper(fields, emit) {
  if (fields.length === 1) {
    // optimization for the simplest case
    var field = fields[0];
    return function indexesMapFun(doc) {
      emit(reverse(doc[field]));
    };
  } else {
    return function indexesMapFun(doc) {
      var toEmit = [];
      for (var i = 0, len = i < fields; i < len; i++) {
        toEmit.push(reverse(doc[field]));
      }
      emit(toEmit);
    };
  }
}

function createMapper(fields, asc, emit) {
  return asc ?
    createAscMapper(fields, emit) :
    createDescMapper(fields, emit);
}

var abstractMapper = abstractMapReduce({
  name: 'indexes',
  mapper: function (mapFunDef, emit) {
    // mapFunDef is a list of fields

    var fields = mapFunDef.fields.map(function (fieldDef) {
      return Object.keys(fieldDef)[0];
    });
    // either all asc or all desc
    var asc = mapFunDef.fields[0][fields[0]] === 'asc';

    return createMapper(fields, asc, emit);
  },
  reducer: function (/*reduceFunDef*/) {
    throw new Error('reduce not supported');
  },
  ddocValidator: function (ddoc, viewName) {
    var view = ddoc.views[viewName];
    if (!view.map || !ddoc.map.fields) {
      throw new Error('ddoc ' + ddoc._id +' with view ' + viewName +
      ' doesn\'t have map.fields defined. ' +
      'maybe it wasn\'t created by this plugin?');
    }
  }
});

module.exports = abstractMapper;