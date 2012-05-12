var assert = require('assert');
var gov = require('../gov.js');

describe('Governer', function () {
  var Governer = gov.Governer;

  it('should be instantiable', function () {
    var gov = new Governer();
    assert.ok(gov instanceof Governer, 'should be an instance of Governer');
  });

  describe('#startApp', function () {

    describe('should emit an `error` event when', function () {
      it('module is missing', function (done) {
        var gov;
        gov = new Governer();
        gov.on('error', function (err, app) {
          assert.ok(err.message.match(/module/i), 'should be a `module not found` error, got ' + err.message);
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          done();
        });
        gov.startApp('definite-not-found.js')
      });

      it('module is missing `.listen` method', function (done) {
        var gov;
        gov = new Governer();
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
        gov.startApp(__dirname + '/modules/no-listen.js')
      });

      it('the app crashes for any reason', function (done) {
        var gov;
        gov = new Governer();
        gov.on('error', function (err, app) {
          assert.ok(err.name === 'Error', 'should be an Error');
          assert.ok(err.message.match(/^lol$/i), 'message should be `lol`');
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          done();
        });
        gov.startApp(__dirname + '/modules/start-then-crash.js')
      });
    });

    it('should emit a `listening` event when it starts listening', function (done) {
      var gov;
      gov = new Governer();
      gov.on('listening', function (address, app) {
        assert.ok('port' in address, '`address` should have port');
        assert.ok('address' in address, '`address` should have address');
        done();
      });
      gov.startApp(__dirname + '/modules/server.js');
    });
  });
});
