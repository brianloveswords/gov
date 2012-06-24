var colors = require('colors');
function debug(prefix, color) {
  return function () {
    var args = [].slice.call(arguments).map(function (s) {
      var str = s.toString();
      if (str.match(/\\033/)) return str;
      return str.grey;
    });

    args.unshift((prefix || 'debug')[color || 'grey']);
    return console.log.apply(console, args);
  };
}
exports.debug = debug;