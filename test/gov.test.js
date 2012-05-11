var assert = require('assert');
var gov = require('../gov.js');

describe('Governer', function () {
  var Governer = gov.Governer;

  it('should be instantiable', function () {
    var inst = new Governer();
    assert.instanceOf(inst, Governer);
  });

  describe('#startApp', function () {

    describe('should emit an error when', function () {
      it('module is missing', function (done) {
        var inst, app;
        inst = new Governer();
        inst.on('error', function (err) {
          assert.ok(err.message.match(/module/i), 'should be a `module not found` error, got ' + err.message);
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          done();
        });
        app = inst.startApp('definite-not-found.js')
      });

      it('module is missing `.listen` method', function (done) {
        var inst, app;
        inst = new Governer();
        inst.on('error', function (err) {
          assert.ok(err.name === 'TypeError', 'should be a TypeError');
          assert.ok(err.message.match(/listen/i), 'should have `listen` in the message');
          assert.ok(app.errors[0] === err, 'app errors stack should include error');
          done();
        });
        app = inst.startApp(__dirname + '/modules/no-listen.js')
      });

    });
  });
});
