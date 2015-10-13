'use strict';

import buffer from '../binary/buffer';

export default  function defaultBody() {
  return new buffer('', 'binary');
};