var fork = require('child_process').fork;
var util = require('util');
var EventEmitter = require('events').EventEmitter;


var WORKER_PATH = __dirname + '/worker.js';

function Governer(opts) {
  this.options = opts;
  this.apps = { };
}
util.inherits(Governer, EventEmitter);

Governer.prototype.startApp = function startApp(path, opts) {
  var app, worker;
  // Add an entry to the apps table if one doesn't already exist.
  app = this.apps[path] = (this.apps[path] || {
    errors: [],
    worker: null
  });

  // get a new worker
  app.worker = worker = forkWorker();

  // re-emit errors from governer instance
  worker.on('error', function (err) {
    app.errors.unshift(err);
    this.emit('error', err);
  }.bind(this));

  worker.send({ command: 'start', path: path });
  return app;
}


/** private */
function forkWorker() {
  var worker = fork(WORKER_PATH, null, {
    env: process.env,
    cwd: __dirname
  });

  // always expect a type with the message and re-emit
  worker.on('message', function (msg) {
    return worker.emit(msg.type, msg.body);
  });

  return worker;
}

exports.Governer = Governer;