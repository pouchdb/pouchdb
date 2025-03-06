import { clone } from 'pouchdb-utils';

// we restructure the supplied JSON considerably, because the official
// Mango API is very particular about a lot of this stuff, but we like
// to be liberal with what we accept in order to prevent mental
// breakdowns in our users
function massageCreateIndexRequest(requestDef) {
  requestDef = clone(requestDef);

  if (!requestDef.index) {
    requestDef.index = {};
  }

  for (const key of ['type', 'name', 'ddoc']) {
    if (requestDef.index[key]) {
      requestDef[key] = requestDef.index[key];
      delete requestDef.index[key];
    }
  }

  if (requestDef.fields) {
    requestDef.index.fields = requestDef.fields;
    delete requestDef.fields;
  }

  if (!requestDef.type) {
    requestDef.type = 'json';
  }
  return requestDef;
}

export default massageCreateIndexRequest;
