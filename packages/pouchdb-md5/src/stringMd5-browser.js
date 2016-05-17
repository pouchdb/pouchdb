import Md5 from 'spark-md5';

function stringMd5(string) {
  return Md5.hash(string);
}

export default stringMd5;