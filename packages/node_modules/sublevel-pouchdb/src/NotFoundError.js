import inherits from 'inherits';

function NotFoundError(reason) {
  Error.call(this, reason);
}

inherits(NotFoundError, Error);

NotFoundError.prototype.name = 'NotFoundError';

export default NotFoundError;