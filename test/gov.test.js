var util = require('util');
var assert = require('assert');
var Gov = require('../lib/gov.js');
var fs = require('fs');

var STABLE = __dirname + '/modules/stable.js';
var NO_LISTEN = __dirname + '/modules/no-listen.js';
var SLOW_CRASH = __dirname + '/modules/slow-crash.js';
var FAST_CRASH = __dirname + '/modules/fast-crash.js';
var DUMMY_JSON = __dirname + '/modules/dummy.json';
var DUMMY_YML = __dirname + '/modules/dummy.yml';

describe('Gov', function () {
  it('should be instantiable', function () {
    var gov = new Gov();
    assert.ok(gov instanceof Gov, 'should be an instance of Gov');
  });

  describe('#startServer', function () {

    describe('should emit an `error` event when', function () {
      it('module is missing', function (done) {
        var gov = new Gov();
        gov.once('error', function (err, server) {
          assert.ok(err.message.match(/module/i), 'should be a `module not found` error, got ' + err.message);
          assert.ok(server.errors[0] === err, 'server errors stack should include error');
          done();
        });
        gov.startServer('definite-not-found.js')
      });

      it('module is missing `.listen` method', function (done) {
        var gov = new Gov();
        gov.once('error', function (err, server) {
          assert.ok(err.name === 'TypeError', 'should be a TypeError');
          assert.ok(err.message.match(/listen/i), 'should have `listen` in the message');
          assert.ok(server.errors[0] === err, 'server errors stack should include error');
          // we gotta wait a bit before the exitCode is set.
          setTimeout(function () {
            assert.ok(server.worker().exitCode > 0, 'exitCode should be greater than 0');
            done();
          }, 100);
        });
        gov.startServer(NO_LISTEN)
      });

      it('the server crashes for any reason', function (done) {
        var gov = new Gov();
        gov.once('error', function (err, server) {
          assert.ok(err.name === 'Error', 'should be an Error');
          assert.ok(err.message.match(/^lol$/i), 'message should be `lol`');
          assert.ok(server.errors[0] === err, 'server errors stack should include error');
          done();
        });
        gov.startServer(SLOW_CRASH)
      });
    });

    it('should emit a `listening` event when it starts listening', function (done) {
      var gov = new Gov();
      gov.once('listening', function (address, server) {
        assert.ok('port' in address, '`address` should have port');
        assert.ok('address' in address, '`address` should have address');
        done();
      });
      gov.startServer(STABLE);
    });

    it('should be able to serve from a unix domain socket', function (done) {
      var gov = new Gov();
      var socketPath = '/tmp/gov-socket-test.sock';
      gov.once('listening', function (address, server) {
        assert.ok(address === socketPath, 'address should be ' + socketPath + ' got ' + util.inspect(address));
        done();
      });
      gov.startServer(STABLE, { port: socketPath });
    });

    it('should be able to serve from a specified port', function (done) {
      var gov = new Gov();
      var socketPath = '/tmp/gov-socket-test.sock';
      var port = 7291;
      gov.once('listening', function (address, server) {
        assert.ok(address.port === port, 'port should be ' + port + ' got ' + util.inspect(address.port));
        done();
      });
      gov.startServer(STABLE, { port: port });
    });

    it('should be able to serve from a specified address', function (done) {
      var gov = new Gov();
      var socketPath = '/tmp/gov-socket-test.sock';
      var addy = '0.0.0.0';
      gov.once('listening', function (address, server) {
        assert.ok(address.address === addy, 'host should be ' + addy + ' got ' + util.inspect(address.addy));
        done();
      });
      gov.once('error', function (err) {
        assert.ok(false, 'not expecting an error, shiiiiit: ' + util.inspect(err));
      });
      gov.startServer(STABLE, { address: addy });
    });


    it('should try to restart a crashing server', function (done) {
      var gov = new Gov({ restart: true });
      var gotDeath = false;
      var gotRestart = false;

      gov.once('death', function (err, server) {
        gotDeath = true;
      });

      gov.once('restarting', function (err, server) {
        gotRestart = true;
        gov.once('listening', function (address, server) {
          // wait a bit to make sure we have a chance to catch the `death` event
          setTimeout(function () {
            assert.ok(server.restarts === 1, 'should have restarted once');
            assert.ok(gotRestart, 'should have gotten a `restart` event');
            assert.ok(gotDeath, 'should have gotten a `death` event');
            server.kill();
            done();
          }, 200);
        });
      });

      gov.startServer(SLOW_CRASH);
    });

    it('should not try to restart a faulty server', function (done) {
      var gov = new Gov({ restart: true });

      gov.once('restarting', function () {
        assert.ok(false, 'should not try to restart a shitty server');
        done();
      });

      gov.once('faulty', function (err) {
        assert.ok(err.message === 'fast crash', 'should be a `fast crash` error');
        done();
      });

      gov.startServer(FAST_CRASH);
    });
  });

  // we have to do this in a weird way -- for some reason, fs.watch on .json files
  // does not work inside of `it()` blocks. I have no idea why.
  describe('watching directories', function () {
    var server = new Gov().makeServer(STABLE);

    before(function () {
      server.watch();
    });

    it('should watch directory for changggges', function (done) {
      var gov = new Gov({ watch: true });

      server.once('updating', function (changes) {
        assert.ok(changes.length === 2);
        done();
      });

      fs.writeFileSync(DUMMY_JSON, '{"wut": "lol"}');
      fs.writeFileSync(DUMMY_YML, '- wut\n- lol');
    });

  });
});
