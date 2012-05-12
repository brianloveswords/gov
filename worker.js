// * worker
//   - should require, start app, let dictator know deets.
//     - if it has a `.listen`, assume it's a server
//   - catch unexpected errors, pass them to dictator
var path = require('path');

var app;
process.on('message', function (m) {
  var action = commands[m.command]
  if (action) return action(m);
});

process.on('uncaughtException', function (err) {
  emit('error', objectFromError(err));
  process.exit(1);
});

var commands = {
  'start': function startApp(opts) {
    app = require(opts.path);
    app.listen(0, '127.0.0.1');

    app.on('listening', function () {
      emit('listening', app.address());
    });

    app.on('close', function () {
      process.exit(0);
    });
  },

  'stop': function stopApp(opts) {
    app.close();
  }
}

function objectFromError(err) {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    type: err.type,
    timestamp: Date.now()
  }
}

function emit(event, body) {
  process.send({ event: event, body: body });
}