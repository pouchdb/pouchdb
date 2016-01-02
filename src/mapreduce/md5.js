import crypto from 'crypto';

function MD5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

export default MD5;