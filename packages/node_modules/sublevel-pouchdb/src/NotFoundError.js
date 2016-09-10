import inherits from 'inherits';

function NotFoundError() {
  Error.call(this);
}

inherits(NotFoundError, Error);

NotFoundError.prototype.name = 'NotFoundError';

export default NotFoundError;