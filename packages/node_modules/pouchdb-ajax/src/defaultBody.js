import bufferFrom from 'buffer-from'; // ponyfill for Node <6

function defaultBody() {
  return bufferFrom('', 'binary');
}

export default defaultBody;
