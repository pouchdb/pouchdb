const http = require('http');

const [port] = process.argv.slice(2);

const server = http.createServer((request, response) => {
  response.writeHead(500, { 'Content-Type': 'application/json' });
  response.end('{}');
});

server.listen(port, () => {
  console.log(`Down server listening on port ${port}`);
});
