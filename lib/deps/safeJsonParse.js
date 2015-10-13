'use strict';

import vuvuzela from 'vuvuzela';

export default  function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    /* istanbul ignore next */
    return vuvuzela.parse(str);
  }
};