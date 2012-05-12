var _ = require('underscore');
var fork = require('child_process').fork;
var pathutil = require('path');
var fs = require('fs');
var util = require('util');
var EventEmitter = require('events').EventEmitter;


/** private */
var WORKER_PATH = __dirname + '/worker.js';
function forkWorker(options) {
  options = options || {};
  var worker = fork(WORKER_PATH, null, {
    env: _.extend(process.env, { _govOptions: JSON.stringify(options) }),
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

/** private */
var _workers = [];
function destroyAllWorkers() {
  _workers.forEach(function (worker) { worker.kill() });
}

/**
 * Constructor
 */

function App(path, options) {
  this.restarts = 0;
  this.path = path;
  this.options = options;
  this.errors = [];
  this.events = ['error', 'listening', 'death', 'ping', 'updating'];

  if (options.watch) this.watch();
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
  this.lastStarted = Date.now();
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
 * Watch for changes and retart if there are any.
 */

App.prototype.watch = function watch() {
  if (this.watching) return;

  // derived from by mocha/utils (by way of learnboost/up)
  // released under MIT - copyright TJ Holowaychuk, Guillermo Rauch

  var ignore = ['node_modules', '.git'];
  function ignored(path) {
    return !~ignore.indexOf(path);
  }

  /**
   * Lookup files in the given `dir`.
   *
   * @return {Array}
   * @api public
   */

  var filetypes = ['.js', '.coffee', '.json', '.yml'];
  function files(dir, ret) {
    ret = ret || [];

    fs.readdirSync(dir)
      .filter(ignored)
      .forEach(function (p) {
        var ext;
        p = pathutil.join(dir, p);
        ext = pathutil.extname(p);

        if (fs.statSync(p).isDirectory())
          files(p, ret);

        else if (~filetypes.indexOf(ext))
          ret.push(p);
      });

    return ret;
  }


  /**
   * Watch the given `files` for changes
   * and invoke `fn(file)` on modification.
   *
   * @param {Array} files
   * @param {Function} fn
   * @api private
   */
  function _watch(files, fn) {
    files.forEach(function (file) {
      fs.watch(file, function (event, filename) {
        // `filename` not available on all platforms,
        // use `file` since we have it
        fn(file);
      });
    });
  }


  var modified = [];
  var watchFiles = files(pathutil.dirname(this.path));
  _watch(watchFiles, function (file) {
    // We want to wait a small amount of time to collect `watch` events. If a
    // large changeset comes in (say as result of a `git pull`) we don't want
    // to fire off a `restart` for every individual file.
    if (!modified.length) {

      setTimeout(function () {
        // By convention all of the events coming from app instances have the
        // worker as the last argument. It's kinda worthless here, but it's
        // expected so we pass it in.
        this.emit('updating', modified, this._worker);

        // Restart the app and clear the modified array to indicate completion
        // of this changeset.
        this.restart();
        modified = [];
      }.bind(this), 50);
    }
    modified.push(file);
  }.bind(this));

  this.watching = true;
};


/**
 * Fork a new worker and setup event re-emitting.
 *
 * @private
 * @return {Process} worker
 */

App.prototype._newWorker = function newWorker() {
  var worker = forkWorker(this.options);

  // Re-emit events from worker.
  this.events.forEach(function (event) {
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

/**
 * Constructor
 */
function Gov(options) {
  this.options = _.extend({
    stableAfter: 200,
    address: '127.0.0.1',
    watch: false,
    port: 0
  }, options);
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


function bullshit() {
  console.log(__dirname + '/test/modules/dummy.json');
  fs.watch(__dirname + '/test/modules/dummy.json', function (event) {
    console.log('modifieeeeeeed');
  });
}

exports.bullshit = bullshit;

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

      // Don't try to restart it if the server is unstable happened
      if (err.timestamp - app.lastStarted < options.stableAfter)
        return this.emit('faulty', err);

      this.emit('restarting', err);
      return app.restart();
    }
    this.emit('error', err, app);
  }.bind(this));

  // `error` is the first item in the app.events array and we already have a
  // listener for it, so slice it off before we iterate.
  app.events.slice(1).forEach(function (event) {
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
