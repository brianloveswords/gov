var http = require('http');
var app = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ohai\n');
});
setTimeout(function () { throw new Error('lol'); }, 100);
module.exports = app;
