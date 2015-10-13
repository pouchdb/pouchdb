export default function (buffer, resp) {
  buffer.type = resp.headers['content-type'];
};