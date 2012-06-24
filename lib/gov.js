var _ = require('underscore');
var util = require('util');
var pathutil = require('path');
var EventEmitter = require('events').EventEmitter;
var Server = require('./server.js');

/**
 * Constructor
 */
function Gov(options) {
  this.options = _.extend({
    stableAfter: 200,
    address: '0.0.0.0',
    watch: false,
    port: 0
  }, options);
  this.servers = { };
}
util.inherits(Gov, EventEmitter);

/**
 * Make and start a new server
 *
 * @see Gov#makeServer
 * @see Server#start
 * @return {Server} the hopefully now running server.
 */

Gov.prototype.startServer = function startServer(path, options) {
  var server = this.makeServer(pathutil.resolve(path), options);
  server.start();
  return server;
};

/**
 * Make a new server and store it in the governer's server table. If the
 * server already has an entry in the server table, override the options
 * and return the server instance.
 *
 * @param {String} path absolute path to the server to start.
 * @param {Object} options options to pass into the server.
 * @return {Server} an server instance
 */

Gov.prototype.makeServer = function makeServer(path, options) {
  var server, worker;
  options = _.extend(this.options, options);

  if ((server = this.servers[path])) {
    server.options = options;
    return server;
  }
  server = new Server(path, options);

  // Check if we want to restart the server, try to restart and send emit a
  // restarting` signal instead of `error`.
  server.on('error', function (err) {
    if (options.restart) {

      // Don't try to restart it if the server is unstable happened
      if (err.timestamp - server.lastStarted < options.stableAfter)
        return this.emit('faulty', err);

      this.emit('restarting', err);
      return server.restart();
    }
    this.emit('error', err, server);
  }.bind(this));

  // `error` is the first item in the server.events array and we already have a
  // listener for it, so slice it off before we iterate.
  server.events.slice(1).forEach(function (event) {
    server.on(event, function () {
      var args = [].slice.call(arguments);
      // Remove the `worker`, add the `server`.
      args.pop();
      args.push(server);
      args.unshift(event);
      this.emit.apply(this, args);
    }.bind(this));
  }.bind(this));

  return this.servers[path] = server;
};

// don't leave orphans
process.on('exit', Server.destroyAllWorkers);
process.on('uncaughtException', Server.destroyAllWorkers);

module.exports = Gov;