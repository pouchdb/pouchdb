import crypto from 'crypto';

function stringMd5(string) {
  return crypto.createHash('md5').update(string, 'binary').digest('hex');
}

export default stringMd5;
