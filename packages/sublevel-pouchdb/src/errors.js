import inherits from 'inherits';

function NotFoundError(reason) {
  Error.call(this, reason);
}

function EncodingError(reason) {
  Error.call(this, reason);
}

inherits(NotFoundError, Error);
inherits(EncodingError, Error);

NotFoundError.prototype.notFound = true;
NotFoundError.prototype.status = 404;

export {
  NotFoundError,
  EncodingError
};