import crypto from 'crypto';

function binaryMd5(data, callback) {
  var base64 = crypto.createHash('md5').update(data, 'binary').digest('base64');
  callback(base64);
}

export default binaryMd5;
