'use strict';

import crypto from 'crypto';

export default  function (string) {
  return crypto.createHash('md5').update(string).digest('hex');
};