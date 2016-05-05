import toPromise from './toPromise';
import crypto from 'crypto';

var res = toPromise(function (data, callback) {
  var base64 = crypto.createHash('md5').update(data, 'binary').digest('base64');
  callback(null, base64);
});

export default res;
