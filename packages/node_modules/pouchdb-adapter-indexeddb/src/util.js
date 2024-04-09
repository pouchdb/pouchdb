'use strict';

import { createError, IDB_ERROR } from 'pouchdb-errors';
import {
  base64StringToBlobOrBuffer as b64StringToBluffer,
  btoa,
  readAsBinaryString,
} from 'pouchdb-binary-utils';
import { sanitise } from './rewrite';

const DOC_STORE = 'docs';
const META_LOCAL_STORE = 'meta';

function idbError(callback) {
  return function (evt) {
    let message = 'unknown_error';
    if (evt.target && evt.target.error) {
      message = evt.target.error.name || evt.target.error.message;
    }
    callback(createError(IDB_ERROR, message, evt.type));
  };
}

function processAttachment(name, src, doc, isBinary, attachmentFormat) {

  delete doc._attachments[name].stub;

  if (attachmentFormat === 'base64') {
    if (isBinary) {
      const att = src.attachments[doc._attachments[name].digest];
      doc._attachments[name].data = b64StringToBluffer(att.data, att.content_type);
    } else {
      doc._attachments[name].data =
        src.attachments[doc._attachments[name].digest].data;
    }
    delete doc._attachments[name].length;
    return Promise.resolve();
  }

  if (isBinary) {
    doc._attachments[name].data =
      src.attachments[doc._attachments[name].digest].data;
    return Promise.resolve();
  }

  return new Promise(function (resolve) {
    const data = src.attachments[doc._attachments[name].digest].data;
    readAsBinaryString(data, function (binString) {
      doc._attachments[name].data = btoa(binString);
      delete doc._attachments[name].length;
      resolve();
    });
  });
}

function rawIndexFields(ddoc, viewName) {
  // fields are an array of either the string name of the field, or a key value
  const fields = ddoc.views[viewName].options &&
                 ddoc.views[viewName].options.def &&
                 ddoc.views[viewName].options.def.fields || [];

  // Either ['foo'] or [{'foo': 'desc'}]
  return fields.map(function (field) {
    if (typeof field === 'string') {
      return field;
    } else {
      return Object.keys(field)[0];
    }
  });
}

/**
 * true if the view is has a "partial_filter_selector".
 */
function isPartialFilterView(ddoc, viewName) {
  return viewName in ddoc.views &&
    ddoc.views[viewName].options &&
    ddoc.views[viewName].options.def &&
    ddoc.views[viewName].options.def.partial_filter_selector;
}

function naturalIndexName(fields) {
  return '_find_idx/' + fields.join('/');
}

/**
 * Convert the fields the user gave us in the view and convert them to work for
 * indexeddb.
 *
 * fields is an array of field strings. A field string could be one field:
 *   'foo'
 * Or it could be a json path:
 *   'foo.bar'
 */
function correctIndexFields(fields) {
  // Every index has to have deleted at the front, because when we do a query
  // we need to filter out deleted documents.
  return ['deleted'].concat(
    fields.map(function (field) {
      if (['_id', '_rev', '_deleted', '_attachments'].includes(field)) {
        // These properties are stored at the top level without the underscore
        return field.substr(1);
      } else {
        // The custom document fields are inside the `data` property
        return 'data.' + sanitise(field, true);
      }
    })
  );
}

export {
  DOC_STORE,
  META_LOCAL_STORE,
  idbError,
  processAttachment,
  rawIndexFields,
  isPartialFilterView,
  naturalIndexName,
  correctIndexFields
};
