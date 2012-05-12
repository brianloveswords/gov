var path = require('path');
var commands = {};
var server;

var globalOptions = JSON.parse(process.env['_govOptions']);

/**
 * Route a message from the parent to the appropriate command.
 * Silently fails if there is no route for the command.
 *
 * @param {Object} message
 */

process.on('message', function (message) {
  var action = commands[message.command];
  if (action) return action(message.options);
});


/**
 * Emit `error` and `death` events when an uncaught exception occurs.
 *
 * @param {Error} err the uncaught exception
 * @see `objectFromError`
 */

process.on('uncaughtException', function (err) {
  emit('error', objectFromError(err));
  emit('death');
  process.exit(1);
});

/**
 * Emit a `death` event before exiting process.
 */

process.on('exit', function () {
  emit('death');
});


/**
 * Start the server. Emits a listening event to parent with the OS given address
 *
 * @param {Object} options potentially including port and address
 */

commands.start = function startServer(options) {
  var port, address;
  server = require(options.path);
  port = options.port || globalOptions.port || 0;
  address = options.address || globalOptions.address || '127.0.0.1';

  server.listen(port, address);

  server.on('listening', function () {
    emit('listening', server.address());
  });

  server.on('close', function () {
    process.exit(0);
  });
};

/**
 * Stop new connections to the server and finish the process when the
 * server socket is closed.
 */

commands.stop = function stopServer() {
  server.close();
  server.on('close', function () {
    process.exit(0);
  });
};

/**
 * Turn an error into an object that's compatible with `emit`.
 *
 * @param {Error} err an error object
 * @return {Object}
 */

function objectFromError(err) {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    type: err.type,
    timestamp: Date.now()
  };
}

/**
 * Emit an event. If something goes wrong sending the message,
 * just give up and die.
 *
 * @param {String} event name of the event to emit
 * @param {Object} body thing to send.
 */

function emit(event, body) {
  try {
    process.send({ event: event, body: body });
  } catch (ex) {
    process.exit(1);
  }
}

// ping the governer
setInterval(function () {
  emit('ping');
}, globalOptions.pingInterval || 30000);
