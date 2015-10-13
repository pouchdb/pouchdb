'use strict';

import Md5 from 'spark-md5';

export default  function (string) {
  return Md5.hash(string);
};