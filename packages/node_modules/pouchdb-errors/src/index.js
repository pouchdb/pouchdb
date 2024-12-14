class PouchError extends Error {
  constructor(status, name, message) {
    super(message);
    this.status = status;
    this.name = name;
    this.error = true;
  }

  toString() {
    return JSON.stringify({
      status: this.status,
      name: this.name,
      message: this.message,
      reason: this.reason
    });
  }
}

const UNAUTHORIZED = { status:401, name:'unauthorized', message:"Name or password is incorrect." };
const MISSING_BULK_DOCS = { status:400, name:'bad_request', message:"Missing JSON list of 'docs'" };
const MISSING_DOC = { status:404, name:'not_found', message:'missing' };
const REV_CONFLICT = { status:409, name:'conflict', message:'Document update conflict' };
const INVALID_ID = { status:400, name:'bad_request', message:'_id field must contain a string' };
const MISSING_ID = { status:412, name:'missing_id', message:'_id is required for puts' };
const RESERVED_ID = { status:400, name:'bad_request', message:'Only reserved document ids may start with underscore.' };
const NOT_OPEN = { status:412, name:'precondition_failed', message:'Database not open' };
const UNKNOWN_ERROR = { status:500, name:'unknown_error', message:'Database encountered an unknown error' };
const BAD_ARG = { status:500, name:'badarg', message:'Some query argument is invalid' };
const INVALID_REQUEST = { status:400, name:'invalid_request', message:'Request was invalid' };
const QUERY_PARSE_ERROR = { status:400, name:'query_parse_error', message:'Some query parameter is invalid' };
const DOC_VALIDATION = { status:500, name:'doc_validation', message:'Bad special document member' };
const BAD_REQUEST = { status:400, name:'bad_request', message:'Something wrong with the request' };
const NOT_AN_OBJECT = { status:400, name:'bad_request', message:'Document must be a JSON object' };
const DB_MISSING = { status:404, name:'not_found', message:'Database not found' };
const IDB_ERROR = { status:500, name:'indexed_db_went_bad', message:'unknown' };
const WSQ_ERROR = { status:500, name:'web_sql_went_bad', message:'unknown' };
const LDB_ERROR = { status:500, name:'levelDB_went_went_bad', message:'unknown' };
const FORBIDDEN = { status:403, name:'forbidden', message:'Forbidden by design doc validate_doc_update function' };
const INVALID_REV = { status:400, name:'bad_request', message:'Invalid rev format' };
const FILE_EXISTS = { status:412, name:'file_exists', message:'The database could not be created, the file already exists.' };
const MISSING_STUB = { status:412, name:'missing_stub', message:'A pre-existing attachment stub wasn\'t found' };
const INVALID_URL = { status:413, name:'invalid_url', message:'Provided URL is invalid' };

const PROTECTED_PROPS = new Set([
  'status',
  'name',
  'message',
  'stack',
]);

function createError(error, reason) {
  const pouchError = new PouchError(error.status, error.name, error.message);

  // inherit error properties from our parent error manually
  // so as to allow proper JSON parsing.
  for (const name of Object.getOwnPropertyNames(error)) {
    if (typeof error[name] === 'function' || PROTECTED_PROPS.has(name)) {
      continue;
    }
    pouchError[name] = error[name];
  }

  if (reason !== undefined) {
    pouchError.reason = reason;
  }

  return pouchError;
}

function generateErrorFromResponse(err) {

  if (typeof err !== 'object') {
    var data = err;
    err = UNKNOWN_ERROR;
    err.data = data;
  }

  if ('error' in err && err.error === 'conflict') {
    err.name = 'conflict';
    err.status = 409;
  }

  if (!('name' in err)) {
    err.name = err.error || 'unknown';
  }

  if (!('status' in err)) {
    err.status = 500;
  }

  if (!('message' in err)) {
    err.message = err.message || err.reason;
  }

  if (!('stack' in err)) {
    err.stack = (new Error()).stack;
  }

  return err;
}

export {
  UNAUTHORIZED,
  MISSING_BULK_DOCS,
  MISSING_DOC,
  REV_CONFLICT,
  INVALID_ID,
  MISSING_ID,
  RESERVED_ID,
  NOT_OPEN,
  UNKNOWN_ERROR,
  BAD_ARG,
  INVALID_REQUEST,
  QUERY_PARSE_ERROR,
  DOC_VALIDATION,
  BAD_REQUEST,
  NOT_AN_OBJECT,
  DB_MISSING,
  WSQ_ERROR,
  LDB_ERROR,
  FORBIDDEN,
  INVALID_REV,
  FILE_EXISTS,
  MISSING_STUB,
  IDB_ERROR,
  INVALID_URL,
  createError,
  generateErrorFromResponse
};
