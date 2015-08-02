$(document).ready(function() {

  var clearBtn = $("#clear");
  var logFile = $("#logfile");
  var logText = $("#log");

  var buffer = 23; // Lines
  var shown_lines = 0;

  clearBtn.on("click", function() {
    logText.html("");
  });

  socket = io.connect("http://192.168.1.10:80");

  socket.on("info", function(data) {
    logText.html("");
    logFile.html("<b>Log file:</b> " + data.logfile);
	});

  socket.on("line", function(line) {
		var log = logText.html() + "<br>" + line;
    var lines = log.split("<br>");

    if (lines.length > buffer) {
      log = "";

      var pos = lines.length - 1;
      var new_lines = 0;
      while (new_lines < buffer && pos > -1) {
        var l = lines[pos];
        pos--;
        if (l === "<br>" || l === "") continue;
        log = l + "<br>" + log;
        new_lines++;
      }
    }
    logText.html(log);
	});

});
