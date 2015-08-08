var express = require("express");
var crypto = require("crypto");
var fs = require('fs');
var tail = require('./tail');
var sanitizer = require('sanitizer');

var webApp = express();
var webServer = require("http").createServer(webApp);
var webIO = require("socket.io").listen(webServer);
webIO.set('origins', '*:8080');

// SETUP
console.log("TheEntropics Event Server v0.0.1");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var gameconfig = JSON.parse(fs.readFileSync(config.gameconfig, 'utf8'));

console.log();
console.log("Masterserver: " + config.masterserver + (config.masterserverport !== undefined? ":"+config.masterserverport : ""));
console.log("Event ID: " + config.eventid);
console.log("Log file: " + config.logfile);
console.log("Game config: " + gameconfig.gamename);
console.log();

var logfile = tail(config.logfile);

// SOCKET SETUP
webIO.sockets.on("connection", function(socket) {
	socket.emit("info", {"logfile" : config.logfile});
});

// WEB SETUP
webApp.use("/", express.static(__dirname + '/client'));
webApp.get("/", function(req, res) {
	res.sendFile(__dirname + "/client/index.html");
});

//webServer.listen(8080, "0.0.0.0");

// CONNECTING TO MASTERSERVER
console.log("Connecting to Masterserver...");
var ioClient = require('socket.io-client'),
serviceSocket = ioClient.connect("http://"+config.masterserver + (config.masterserverport !== undefined? ":"+config.masterserverport : ""), {reconnect: true});
serviceSocket.on("connect", function (socket) {
	console.log("Connected to Masterserver.");
	serviceSocket.emit("registeraseventserver", {"id" : config.eventservername});
});
serviceSocket.on("updateserverid", function (data) {
	console.log("Updating server id: " + data.id);
});
serviceSocket.on("updateusers", function (data) {
	console.log("Updating users data.");
	//console.log(data);
	generateReferences(data.players);
	checkPlayers();
});
serviceSocket.on("seteventid", function (data) {
	console.log("Assigned to new event: "+data.name+" ("+data.id+")");
	eventid = data.id;
	eventname = data.name;
});
serviceSocket.on("unseteventid", function (data) {
	console.log("Unassigned from event: "+data.name+" ("+data.id+")");
	eventid = 0;
	eventname = "";
});
serviceSocket.on("disconnect", function() {
	console.log("Connection to Masterserver lost.");
	if (eventid !== 0) {
		console.log("Unassigned from event: "+eventname+" ("+eventid+")");
		eventid = 0;
		eventname = "";
	}
});

function notifyRoundStart() {
	//if (eventid !== 0) {
	serviceSocket.emit("roundstart", {"id" : eventid});
	//}
}
function notifyRoundEnd() {
	//if (eventid !== 0) {
	serviceSocket.emit("roundend", {"id" : eventid});
	//}
}
function notifyChanges() {
	if (roundstarted === false) {
		roundstarted = true;
		notifyRoundStart();
	}
	if (eventid !== 0) {
		var userdata = {};
		var cont = 0;
		for (var i in Players) {
			if (Players[i].playerid !== 0 && Players[i].datachanged) {
				var player = Players[i];

				var kills = player.kills - player.last_kills;
				var kamikaze = player.kamikaze - player.last_kamikaze;
				var headshots = player.headshots - player.last_headshots;
				var deaths = player.deaths - player.last_deaths;
				var knives = player.knives - player.last_knives;
				var killstreak = player.killstreak;

				userdata[player.playerid] = {
					"id": player.playerid,
					"kills": (kills !== 0 ? kills : undefined),
					"kamikaze": (kamikaze !== 0 ? kamikaze : undefined),
					"headshots": (headshots !== 0 ? headshots : undefined),
					"deaths": (deaths !== 0 ? deaths : undefined),
					"knives": (knives !== 0 ? knives : undefined),
					"killstreak": (killstreak !== 0 ? killstreak : undefined)
				};

				player.last_kills = player.kills;
				player.last_kamikaze = player.kamikaze;
				player.last_headshots = player.headshots;
				player.last_deaths = player.deaths;
				player.last_knives = player.knives;
				player.datachanged = false;
				cont++;
			}
		}
		if (cont > 0) {
			serviceSocket.emit("updateonplayersdata", {"eventid" : eventid, "players" : userdata});
		}
	}
}

// LOCAL DATA
function getTimestamp() {return new Date().getTime();}
var eventid = 0;
var eventname = "";
var roundstarted = false;
var Players = {};
function Player(id, username) {
	this.id = id;
	this.username = username;
	this.id_check = id+username;
	this.playerid = 0;

	this.kills = 0;
	this.kamikaze = 0;
	this.headshots = 0;
	this.deaths = 0;
	this.knives = 0;
	this.killstreak = 0;

	this.lastkill_timestamp = 0;
	this.lastkamikaze_timestamp = 0;

	// Last update to server
	this.last_kills = 0;
	this.last_kamikaze = 0;
	this.last_headshots = 0;
	this.last_deaths = 0;
	this.last_knives = 0;
	//this.last_killstreak = 0;

	this.datachanged = false;
	var that = this;
	this.setPlayerID = function(id) {
		that.playerid = id;
		that.datachanged = true;
	}
	this.addKill = function() {
		that.kills++;
		that.killstreak++;
		that.lastkill_timestamp = getTimestamp();
		that.datachanged = true;
	};
	this.addKamikaze = function() {
		that.kamikaze++;
		that.datachanged = true;
	};
	this.addHeadshot = function() {
		that.headshots++;
		that.datachanged = true;
	};
	this.addKnife = function() {
		that.knives++;
		that.datachanged = true;
	};
	this.addDeath = function() {
		that.deaths++;
		that.killstreak = 0;
		that.datachanged = true;
	};
};

var References = {};
function generateReferences(players) {
	References = {};
	for (var i in players) {
		for (var j in players[i]) {
			References[players[i][j]] = i;
		}
	}
	//console.log(References);
}
function checkPlayers() {
	for (var i in Players) {
		if (References[Players[i].username] !== undefined) {
			Players[i].setPlayerID(References[Players[i].username]);
			console.log("Found player: " + Players[i].username + "(" + Players[i].playerid + ")");
		}
	}
}
function resetData() {
	Players = {};
}

// LOG FILE
logfile.on("line", function(line) {

	var message = "";
	var changesmade = false;
	// KILL EVENT
	var regexstr = gameconfig.event_regex;
	if (gameconfig.kill_event_regex !== undefined) regexstr = gameconfig.kill_event_regex;

	var match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.kill_event_match) {
			if (gameconfig.kill_event_bywhoid_regex !== undefined && gameconfig.kill_event_towhoid_regex !== undefined && gameconfig.kill_event_bywho_regex !== undefined && gameconfig.kill_event_towho_regex !== undefined) {
				var bywhoid = line.match(new RegExp(gameconfig.kill_event_bywhoid_regex, ""))[1];
				var towhoid = line.match(new RegExp(gameconfig.kill_event_towhoid_regex, ""))[1];
				var bywho = line.match(new RegExp(gameconfig.kill_event_bywho_regex, ""))[1];
				var towho = line.match(new RegExp(gameconfig.kill_event_towho_regex, ""))[1];

				// Creating players if needed
				if (Players[bywhoid] === undefined || Players[bywhoid].id_check !== (bywhoid+bywho)) {
					Players[bywhoid] = new Player(bywhoid, bywho);
					if (References[username] !== undefined) {
						Players[bywhoid].setPlayerID(References[bywho]);
					}
					message += bywho + " (" + (Players[bywhoid].playerid !== 0 ? Players[bywhoid].playerid : bywhoid) + ") joined the game. [KillEvent]\n";
				}
				if (Players[towhoid] === undefined || Players[towhoid].id_check !== (towhoid+towho)) {
					Players[towhoid] = new Player(towhoid, towho);
					if (References[username] !== undefined) {
						Players[towhoid].setPlayerID(References[towho]);
					}
					message += towho + " (" + (Players[towhoid].playerid !== 0 ? Players[towhoid].playerid : towhoid) + ") joined the game. [KillEvent]\n";
				}

				if (bywhoid === towhoid) {
					message += bywho + " killed himself.";
					Players[towhoid].addDeath();
				} else {
					Players[bywhoid].addKill();
					Players[towhoid].addDeath();
					message += bywho + " killed " + towho + ". [" + Players[bywhoid].kills + "]";

					// Kamikaze Event Detection
					if (Math.abs(Players[bywhoid].lastkill_timestamp - Players[bywhoid].lastkamikaze_timestamp) < 1000) {
						message += "\n" + bywho + " (" + bywhoid + ") kamikaze! [KillEvent]";
						Players[bywhoid].addKamikaze();
						Players[bywhoid].lastkamikaze_timestamp = 0;
					}
				}
				changesmade = true;
			}
		}
	}

	// KAMIKAZE EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.kamikaze_event_regex !== undefined) regexstr = gameconfig.kamikaze_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.kamikaze_event_match || gameconfig.kamikaze_event_match === "") {
			if (gameconfig.kamikaze_event_id_regex !== undefined) {
				var userid = line.match(new RegExp(gameconfig.kamikaze_event_id_regex, ""))[1];

				if (Players[userid] != undefined) {
					var username = Players[userid].username;
					var timestamp = getTimestamp();
					if (Math.abs(timestamp - Players[userid].lastkill_timestamp) < 1000) {
						message += "\n" + username + " (" + userid + ") kamikaze!";
						Players[userid].addKamikaze();
						changesmade = true;
					} else {
						Players[userid].lastkamikaze_timestamp = timestamp;
					}
				}
			}
		}
	}

	// KNIFE EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.knife_event_regex !== undefined) regexstr = gameconfig.knife_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.knife_event_match || gameconfig.knife_event_match === "") {
			if (gameconfig.knife_event_id_regex !== undefined && gameconfig.knife_event_name_regex !== undefined) {
				var userid = line.match(new RegExp(gameconfig.knife_event_id_regex, ""))[1];
				var name = line.match(new RegExp(gameconfig.knife_event_name_regex, ""))[1];

				// Creating player if needed
				if (Players[userid] === undefined || Players[userid].id_check !== (userid+name)) {
					Players[userid] = new Player(userid, name);
					if (References[name] !== undefined) {
						Players[userid].setPlayerID(References[name]);
					}
					message += name + " (" + (Players[userid].playerid !== 0 ? Players[userid].playerid : userid) + ") joined the game. [KnifeEvent]\n";
				}

				Players[userid].addKnife();

				message += (message === "" ? "" : "\n") + name + " made a knife kill! [" + Players[userid].knives + "]";
				changesmade = true;
			}
		}
	}

	// HIT EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.hit_event_regex !== undefined) regexstr = gameconfig.hit_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.hit_event_match) {
			if (gameconfig.hit_event_bywhoid_regex !== undefined && gameconfig.hit_event_bywho_regex !== undefined) {
				var bywhoid = line.match(new RegExp(gameconfig.hit_event_bywhoid_regex, ""))[1];
				var bywho = line.match(new RegExp(gameconfig.hit_event_bywho_regex, ""))[1];

				if (gameconfig.headshot_event_regex !== undefined) {
					match = line.match(new RegExp(gameconfig.headshot_event_regex, ""));
					if (match != null) {
						match = match[1];
						if (match === gameconfig.headshot_event_match) {
							// Creating player if needed
							if (Players[bywhoid] === undefined || Players[bywhoid].id_check !== (bywhoid+bywho)) {
								Players[bywhoid] = new Player(bywhoid, bywho);
								if (References[bywho] !== undefined) {
									Players[bywhoid].setPlayerID(References[bywho]);
								}
								message += bywho + " (" + (Players[bywhoid].playerid !== 0 ? Players[bywhoid].playerid : bywhoid) + ") joined the game. [HitEvent]\n";
							}

							Players[bywhoid].addHeadshot();

							message += (message === "" ? "" : "\n") + bywho + " made a headshot! [" + Players[bywhoid].headshots + "]";
							changesmade = true;
						}
					}
				}

			}
		}
	}

	// USER JOIN EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.userjoin_event_regex !== undefined) regexstr = gameconfig.userjoin_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.userjoin_event_match) {
			if (gameconfig.userjoin_event_id_regex !== undefined && gameconfig.userjoin_event_name_regex !== undefined) {
				var userid = line.match(new RegExp(gameconfig.userjoin_event_id_regex, ""))[1];
				var username = line.match(new RegExp(gameconfig.userjoin_event_name_regex, ""))[1];

				if (Players[userid] != undefined) {
					var oldUser = Players[userid];
					if (oldUser.username !== username) {

						if (oldUser.playerid !== 0) {
							/*if (References[username] === undefined) {
								// Delete old player data
								Players[userid] = new Player(userid, username);
								message = username + " (" + userid + ") joined the game. [Nickname changed]";
							} else */
							if (oldUser.playerid !== References[username]) {
								// Delete old player data
								Players[userid] = new Player(userid, username);
								if (References[username] !== undefined) {
									Players[userid].setPlayerID(References[username]);
								}
								message = username + " (" + (Players[userid].playerid !== 0 ? Players[userid].playerid : userid) + ") joined the game. [Nickname changed]";
							} else {
								// Or assuming player changed nickname
								Players[userid].username = username;
								Players[userid].id_check = userid+username;
								message = username + " (" + oldUser.playerid + ") changed nickname.";
							}
						} else {
							// Delete old player data
							//Players[userid] = new Player(userid, username);
							//message = username + " (" + userid + ") joined the game.";

							// Or assuming player changed nickname
							Players[userid].username = username;
							Players[userid].id_check = userid+username;
							message = username + " (" + userid + ") changed nickname.";
						}
					}
				} else {
					Players[userid] = new Player(userid, username);
					if (References[username] !== undefined) {
						Players[userid].setPlayerID(References[username]);
					}
					message = username + " (" + (Players[userid].playerid !== 0 ? Players[userid].playerid : userid) + ") joined the game.";
				}
			}
		}
	}

	// USER LEAVE EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.userleave_event_regex !== undefined) regexstr = gameconfig.userleave_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.userleave_event_match) {
			if (gameconfig.userleave_event_id_regex !== undefined) {
				var userid = line.match(new RegExp(gameconfig.userleave_event_id_regex, ""))[1];
				if (Players[userid] != undefined) {
					var username = Players[userid].username;

					message = username + " (" + (Players[userid].playerid !== 0 ? Players[userid].playerid : userid) + ") left the game.";

					Players[userid] = undefined;
				}
			}
		}
	}

	// ROUND START EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.roundstart_event_regex !== undefined) regexstr = gameconfig.roundstart_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.roundstart_event_match) {
			message = "Round started!";
			roundstarted = true;
			notifyRoundStart();
		}
	}

	// ROUND END EVENT
	regexstr = gameconfig.event_regex;
	if (gameconfig.roundend_event_regex !== undefined) regexstr = gameconfig.roundend_event_regex;

	match = line.match(new RegExp(regexstr, ""));
	if (match != null) {
		match = match[1];
		if (match === gameconfig.roundend_event_match) {
			message = "Round ended!";
			roundstarted = false;
			resetData();
			notifyRoundEnd();
		}
	}

	// END OF EVENTS
	if (message === undefined || message === "") return;

	// SEND DATA
	webIO.sockets.emit("line", sanitizer.escape(message));
	console.log(message);

	if (changesmade === true) {
		notifyChanges();
		changesmade = false;
	}
});
