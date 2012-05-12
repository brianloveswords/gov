var _ = require('underscore');
var fork = require('child_process').fork;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _workers = [];

var WORKER_PATH = __dirname + '/worker.js';

/** private */
function forkWorker(options) {
  options = options || {};
  var worker = fork(WORKER_PATH, null, {
    env: _.extend(process.env, { _governerOptions: JSON.stringify(options) }),
    cwd: __dirname
  });

  // Messages coming from worker.js will always have the form:
  //  { event: <event name>, body: <object> }
  worker.on('message', function (msg) {
    return worker.emit(msg.event, msg.body);
  });

  _workers.push(worker);
  return worker;
}

function destroyAllWorkers() {
  _workers.forEach(function (worker) { worker.kill() });
}

function App(path, options) {
  this.restarts = 0;
  this.path = path;
  this.options = options;
  this.errors = [];
}
util.inherits(App, EventEmitter);

/**
 * Make or retrieve the app's worker.
 *
 * @return {Process} worker
 */

App.prototype.worker = function worker() {
  this._worker = this._worker || this._newWorker();
  return this._worker;
};


/**
 * Send `start` command to the worker.
 *
 * @return {App} this
 */

App.prototype.start = function start() {
  this.worker().send({
    command: 'start',
    options: _.extend({ path: this.path }, this.options)
  });
  return this;
};

/**
 * Send the `stop` command to the worker. Use the internal handle for the
 * worker so we don't fork a new worker just to stop it.
 *
 * @return {App} this
 */

App.prototype.stop = function stop() {
  if (!this._worker) return this;
  this._worker.send({command: 'stop'});
  return this;
};

/**
 * Start a new worker and increment the restart counter. Kill the old worker
 * if it's not already dead.
 *
 * @return {App} this
 */

App.prototype.restart = function restart() {
  this.restarts += 1;
  this.kill();
  this._worker = null;
  this.start();
};



/**
 * Kill the worker (send a signal).
 *
 * @see Process#kill
 * @return this
 */

App.prototype.kill = function kill(signal) {
  if (!this._worker) return this;
  this._worker.kill(signal);
  return this;
};


/**
 * Fork a new worker and setup event re-emitting.
 *
 * @private
 * @return {Process} worker
 */

App.prototype._newWorker = function newWorker() {
  var worker = forkWorker(this.options);
  var events = ['error', 'listening', 'death'];

  // Re-emit events from worker.
  events.forEach(function (event) {
    worker.on(event, function () {
      var args = [].slice.call(arguments);

      // Special case for error: we want to keep track of all of the errors
      // that occur so we can inspect them later, or print them to logs or
      // whatever.
      if (event === 'error')
        this.errors.unshift(args[0]);

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
};

function Gov(options) {
  this.options = options || { };
  this.apps = { };
}
util.inherits(Gov, EventEmitter);

/**
 * Make and start a new application.
 *
 * @see Gov#makeApp
 * @see App#start
 * @return {App} the hopefully now running application.
 */

Gov.prototype.startApp = function startApp(path, options) {
  var app = this.makeApp(path, options);
  app.start();
  return app;
};

/**
 * Make a new application and store it in the governer's app table. If the
 * application already has an entry in the apps table, override the options
 * and return the app instance.
 *
 * @param {String} path absolute path to the application to start.
 * @param {Object} options options to pass into the application.
 * @return {App} an application instance
 */

Gov.prototype.makeApp = function makeApp(path, options) {
  var app, worker;
  options = _.extend(this.options, options);

  if ((app = this.apps[path])) {
    app.options = options;
    return app;
  }
  app = new App(path, options);

  // Check if we want to restart the app, try to restart and send emit a
  // restarting` signal instead of `error`.
  app.on('error', function (err) {
    if (options.restart) {
      this.emit('restarting', err);
      return app.restart();
    }
    this.emit('error', err, app);
  }.bind(this));

  (['death', 'listening']).forEach(function (event) {
    app.on(event, function () {
      var args = [].slice.call(arguments);
      // Remove the `worker`, add the `app`.
      args.pop();
      args.push(app);
      args.unshift(event);
      this.emit.apply(this, args);
    }.bind(this));
  }.bind(this));

  return this.apps[path] = app;
};

// don't leave orphans
process.on('exit', destroyAllWorkers);
process.on('uncaughtException', destroyAllWorkers);

exports.Gov = Gov;
