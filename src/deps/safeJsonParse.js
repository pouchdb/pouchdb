import vuvuzela from 'vuvuzela';

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    /* istanbul ignore next */
    return vuvuzela.parse(str);
  }
}

export default safeJsonParse;