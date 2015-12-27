import Md5 from 'spark-md5';

function md5(string) {
  return Md5.hash(string);
}

export default md5;