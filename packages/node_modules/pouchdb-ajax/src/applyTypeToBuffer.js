// non-standard, but we do this to mimic blobs in the browser
function applyTypeToBuffer(buffer, resp) {
  buffer.type = resp.headers['content-type'];
}

export default applyTypeToBuffer;