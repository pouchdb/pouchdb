import uuid from 'uuid';

function rev() {
  return uuid.v4().replace(/-/g, '').toLowerCase();
}

export default rev;
