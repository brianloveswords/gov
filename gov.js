var _ = require('underscore');
var fork = require('child_process').fork;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var WORKER_PATH = __dirname + '/worker.js';

/** private */
function forkWorker() {
  var worker = fork(WORKER_PATH, null, {
    env: process.env,
    cwd: __dirname
  });

  // Messages coming from worker.js will always have the form:
  //  { event: <event name>, body: <object> }
  worker.on('message', function (msg) {
    return worker.emit(msg.event, msg.body);
  });

  return worker;
}


function App(path, options) {
  this.path = path;
  this.options = options;
  this.errors = []
}; util.inherits(App, EventEmitter);

/**
 * Make or retrieve the app's worker.
 *
 * @return {Process} worker
 */

App.prototype.worker = function worker() {
  this._worker = this._worker || this._newWorker();
  return this._worker;
}


/**
 * Send `start` command to the worker.
 *
 * @return {App} this
 */

App.prototype.start = function start() {
  this.worker().send({
    command: 'start',
    path: this.path
  });
  return this;
}

/**
 * Fork a new worker and setup event re-emitting.
 *
 * @private
 * @return {Process} worker
 */

App.prototype._newWorker = function newWorker() {
  var worker = forkWorker();
  var events = ['error', 'listening'];

  // Re-emit events from worker.
  events.forEach(function (event) {
    worker.on(event, function () {
      var args = [].slice.call(arguments);

      // Special case for error: we want to keep track of all of the errors
      // that occur so we can inspect them later, or print them to logs or
      // whatever.
      if (event === 'error')
        this.errors.unshift(args[0])

      // We might need the `worker`, so add it to the end of the arguments
      // list. We also need the `event` at the front so `emit` knows what
      // it's doing.
      args.push(worker);
      args.unshift(event);

      // Emit that fucker!
      this.emit.apply(this, args);
    }.bind(this));
  }.bind(this));

  return worker;
}

function Governer(options) {
  this.options = options;
  this.apps = { };
}; util.inherits(Governer, EventEmitter);

/**
 * Make and start a new application.
 *
 * @see Governer#makeApp
 * @see App#start
 * @return {App} the hopefully now running application.
 */

Governer.prototype.startApp = function startApp(path, options) {
  var app = this.makeApp(path, options);
  app.start();
  return app;
}

/**
 * Make a new application and store it in the governer's app table. If the
 * application already has an entry in the apps table, override the options
 * and return the app instance.
 *
 * @param {String} path absolute path to the application to start.
 * @param {Object} options options to pass into the application.
 * @return {App} an application instance
 */

Governer.prototype.makeApp = function makeApp(path, options) {
  var app, worker;

  app = this.apps[path];
  if (app) {
    app.options = options;
    return app;
  }

  app = new App(path, options);

  // re-emit events
  app.on('error', function (err) {
    this.emit('error', err, app);
  }.bind(this));

  app.on('listening', function (address) {
    this.emit('listening', address, app);
  }.bind(this));

  return this.apps[path] = app;
}


exports.Governer = Governer;