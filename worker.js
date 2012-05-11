// * worker
//   - should require, start app, let dictator know deets.
//     - if it has a `.listen`, assume it's a server
//   - catch unexpected errors, pass them to dictator
var path = require('path');

var app;
process.on('message', function (m) {
  if (m.command === 'start')
    return startApp(m);
  if (m.command === 'stop')
    return stopApp(m);
});

process.on('uncaughtException', function (err) {
  process.send({
    type: 'error',
    body: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      timestamp: Date.now()
    }
  });
  process.exit(1);
});

function startApp(opts) {
  app = require(opts.path);
  app.listen(0, '127.0.0.1');
  app.on('listening', function () {
    process.send({ type: 'started', address: app.address() })
  });
  app.on('close', function () {
    process.exit(0);
  })
}

function stopApp(opts) { app.close() }