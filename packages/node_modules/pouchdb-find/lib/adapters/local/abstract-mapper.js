'use strict';

var abstractMapReduce = require('pouchdb-abstract-mapreduce');

function createMapper(fields, asc, emit) {
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

var abstractMapper = abstractMapReduce({
  name: 'indexes',
  mapper: function (mapFunDef, emit) {
    // mapFunDef is a list of fields

    var fields = Object.keys(mapFunDef.fields);
    // either all asc or all desc
    var asc = mapFunDef.fields[fields[0]] === 'asc';

    return createMapper(fields, asc, emit);
  },
  reducer: function (/*reduceFunDef*/) {
    throw new Error('reduce not supported');
  },
  ddocValidator: function (ddoc, viewName) {
    var view = ddoc.views[viewName];
    if (!view.map || !view.map.fields) {
      throw new Error('ddoc ' + ddoc._id +' with view ' + viewName +
      ' doesn\'t have map.fields defined. ' +
      'maybe it wasn\'t created by this plugin?');
    }
  }
});

module.exports = abstractMapper;