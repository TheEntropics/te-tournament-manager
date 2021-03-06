var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');

var Tail = function (path) {
  EventEmitter.call(this);
  var that = this;

  var fNameStat = fs.statSync(path);

  if (!fNameStat.isFile()) {
    console.error(path + ' is not a file.');
    process.exit();
  }

  var currDataLength = fNameStat.size;
  var readDataLength = fNameStat.size;
  setInterval(function() {
    var fNameStatChanged = fs.statSync(path);
    if (fNameStatChanged.size > currDataLength) {
      fs.open(path, 'r', function(err, fd) {
        if (err) {
          console.log("Can't open file. Skipping iteration.");
          console.error(err);
          return;
        };
        var newDataLength = fNameStatChanged.size - readDataLength;
        var buffer = new Buffer(newDataLength, 'utf-8');
        fs.read(fd, buffer, 0, newDataLength, readDataLength, function (err, bytesRead, newData) {
          if (err) {
            console.error("Error reading file. Skipping iteration.");
            console.error(err);
            return;
          };
          var usedLinesLength = 0;
          var lines = newData.toString('utf-8').split('\n');
          lines.pop();
          lines.forEach(function (line) {
              that.emit('line', line);
              usedLinesLength += Buffer.byteLength(line, 'utf8') + Buffer.byteLength("\n", 'utf8');
          });
          currDataLength = fNameStatChanged.size;
          readDataLength += usedLinesLength;
          fs.close(fd);
        });
        fs.close(fd);
      });
    }
  }, 500);
};
util.inherits(Tail, EventEmitter);

module.exports = function (path) {
    return new Tail(path);
};
