var util = require('util');
var assert = require('assert');
var gov = require('../gov.js');


var STABLE = __dirname + '/modules/server.js';
var NO_LISTEN = __dirname + '/modules/no-listen.js';
var SLOW_CRASHER = __dirname + '/modules/start-then-crash.js';

describe('Governer', function () {
  var Governer = gov.Governer;

  it('should be instantiable', function () {
    var gov = new Governer();
    assert.ok(gov instanceof Governer, 'should be an instance of Governer');
  });

  describe('#startApp', function () {

    describe('should emit an `error` event when', function () {
      it('module is missing', function (done) {
        var gov = new Governer();
        gov.on('error', function (err, app) {
          assert.ok(err.message.match(/module/i), 'should be a `module not found` error, got ' + err.message);
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          done();
        });
        gov.startApp('definite-not-found.js')
      });

      it('module is missing `.listen` method', function (done) {
        var gov = new Governer();
        gov.on('error', function (err, app) {
          assert.ok(err.name === 'TypeError', 'should be a TypeError');
          assert.ok(err.message.match(/listen/i), 'should have `listen` in the message');
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          // we gotta wait a bit before the exitCode is set.
          setTimeout(function () {
            assert.ok(app.worker().exitCode > 0, 'exitCode should be greater than 0');
            done();
          }, 100);
        });
        gov.startApp(NO_LISTEN)
      });

      it('the app crashes for any reason', function (done) {
        var gov = new Governer();
        gov.on('error', function (err, app) {
          assert.ok(err.name === 'Error', 'should be an Error');
          assert.ok(err.message.match(/^lol$/i), 'message should be `lol`');
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          done();
        });
        gov.startApp(SLOW_CRASHER)
      });
    });

    it('should emit a `listening` event when it starts listening', function (done) {
      var gov = new Governer();
      gov.on('listening', function (address, app) {
        assert.ok('port' in address, '`address` should have port');
        assert.ok('address' in address, '`address` should have address');
        done();
      });
      gov.startApp(STABLE);
    });

    it('should be able to serve from a unix domain socket', function (done) {
      var gov = new Governer();
      var socketPath = '/tmp/gov-socket-test.sock';
      gov.on('listening', function (address, app) {
        assert.ok(address === socketPath, 'address should be ' + socketPath + ' got ' + util.inspect(address));
        done();
      });
      gov.startApp(STABLE, { port: socketPath });
    });

    it('should be able to serve from a specified port', function (done) {
      var gov = new Governer();
      var socketPath = '/tmp/gov-socket-test.sock';
      var port = 7291;
      gov.on('listening', function (address, app) {
        assert.ok(address.port === port, 'port should be ' + port + ' got ' + util.inspect(address.port));
        done();
      });
      gov.startApp(STABLE, { port: port });
    });

    it('should be able to serve from a specified address', function (done) {
      var gov = new Governer();
      var socketPath = '/tmp/gov-socket-test.sock';
      var addy = '0.0.0.0';
      gov.on('listening', function (address, app) {
        assert.ok(address.address === addy, 'host should be ' + addy + ' got ' + util.inspect(address.addy));
        done();
      });
      gov.on('error', function (err) {
        assert.ok(false, 'not expecting an error, shiiiiit: ' + util.inspect(err));
      });
      gov.startApp(STABLE, { address: addy });
    });


    it('should try to restart a crashing server', function (done) {
      var gov = new Governer({ restart: true });
      gov.startApp(SLOW_CRASHER);

      var gotDeath = false;
      var gotRestart = false;

      gov.once('death', function (err, app) {
        gotDeath = true;
      });

      gov.once('restarting', function (err, app) {
        gotRestart = true;
        gov.once('listening', function (address, app) {
          // wait a bit to make sure we have a chance to catch the `death` event
          setTimeout(function () {
            assert.ok(app.restarts === 1, 'should have restarted once');
            assert.ok(gotRestart, 'should have gotten a `restart` event');
            assert.ok(gotDeath, 'should have gotten a `death` event');
            app.kill();
            done();
          }, 200);
        });

      });
    });
  });
});
