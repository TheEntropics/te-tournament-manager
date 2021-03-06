var express = require("express");
var crypto = require("crypto");
var fs = require('fs');
var sanitizer = require('sanitizer');

var app = express();
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);
var dl  = require('delivery');

io.set('origins', '*:80');

// SETUP
console.log("TheEntropics Mastererver v0.0.1");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log();
//console.log("Title: " + config.title);
///console.log();

var Players = {};
var Teams = {};
var Events = {};

// DATABASE
var Database = {};
function PlayerRecord(id) {
	this.id = id;

	this.data = {
		"kills" : 0,
		"deaths" : 0,
		"headshots" : 0,
		"knives" : 0,
		"kamikaze" : 0,
		"killstreak" : 0
	}

	this.events = {};
	var that = this;
	this.updateKills = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.data.kills += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].kills += n;
	};

	this.updateDeaths = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.data.deaths += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].deaths += n;
	};

	this.updateHeadshots = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.data.headshots += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].headshots += n;
	};

	this.updateKnives = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.data.knives += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].knives += n;
	};

	this.updateKamikaze = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.data.kamikaze += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].kamikaze += n;
	};

	this.updateKillstreak = function(n, eventid) {
		if (n === undefined || n === 0) return;
		if (that.data.killstreak < n) {
			that.data.killstreak = n;
			if (eventid === undefined) return;
			if (that.events[eventid] === undefined) {
				that.addEvent(eventid);
			}
			that.events[eventid].killstreak = n;
		}
	};
	this.addEvent = function(eventid) {
		that.events[eventid] = {
			"eventid" : eventid,
			"kills" : 0,
			"deaths" : 0,
			"headshots" : 0,
			"knives" : 0,
			"kamikaze" : 0,
			"killstreak" : 0
		};
	};
};

function updateDatabase(data) {
	for (var i in data.players) {
		var player = data.players[i];
		if (Database[player.id] === undefined) {
			Database[player.id] = new PlayerRecord(player.id);
		}
		Database[player.id].updateKills(player.kills, data.eventid);
		Database[player.id].updateDeaths(player.deaths, data.eventid);
		Database[player.id].updateKamikaze(player.kamikaze, data.eventid);
		Database[player.id].updateHeadshots(player.headshots, data.eventid);
		Database[player.id].updateKnives(player.knives, data.eventid);
		Database[player.id].updateKillstreak(player.killstreak, data.eventid);
	}
	//console.log(Database);
}

// INTERNAL OBJECTS
function getNewID() {return new Date().getTime();}

function Player(username, image, team, nicknames, rawid) {
	this.id = rawid || "P"+getNewID();
	this.type = "player";
	this.username = username;
	this.nicknames = nicknames;
	this.image = image || "default";
	this.team = 0;
	Players[this.id] = this;
	var that = this;
	this.changeTeam = function(team) {
		// Remove player from old team, if any
		if (that.team !== undefined && Teams[that.team] !== undefined) {
			var index = Teams[that.team].players.indexOf(that.id);
			Teams[that.team].players.splice(index, 1);
			updateEventServers(that.team);
		}
		// Update new team, if any
		if (Teams[team] !== undefined) {
			Teams[team].players.push(that.id);
			that.team = team;
		} else {
			that.team = undefined;
		}
	}
	Database[this.id] = new PlayerRecord(this.id);
	this.changeTeam(team);
}

function Team(name, color, teamplayers, rawid) {
	this.id = rawid || "T"+getNewID();
	this.type = "team";
	this.name = name;
	this.color = color;
	this.players = [];
	Teams[this.id] = this;

	for (var i in teamplayers) {
		if (Players[teamplayers[i]] !== undefined) {
			Players[teamplayers[i]].changeTeam(this.id);
		} else {
			console.log(teamplayers[i] + " does not exist! [Team]");
		}
	}

	var that = this;
	this.removeAllPlayers = function() {
		//console.log(that.players);
		for (var i in that.players) {
			if (Players[that.players[i]] !== undefined) {
				Players[that.players[i]].changeTeam(undefined);
			} else {
				//console.log(that.players[i] + " does not exist! [removeAllPlayers]");
				//console.log(Players);
			}
		}
	}
	this.setPlayers = function(teamplayers) {
		that.removeAllPlayers();
		for (var i in teamplayers) {
			if (Players[i] !== undefined) {
				Players[i].changeTeam(that.id);
			}
		}
	}
}

function Event(name, partecipants, eventserverid, rounds, warmupround, rawid) {
	this.id = rawid || "E"+getNewID();
	this.type = "event";
	this.name = name;
	this.partecipants = [];
	this.rounds = rounds || 1;
	this.warmupround = warmupround || false;
	this.eventserverid = eventserverid || 0;
	Events[this.id] = this;
	var that = this;
	this.removePartecipant = function(id) {
		if (id === undefined) return;
		var index = that.partecipants.indexOf(id);
		if (index !== -1) {
			that.partecipants.splice(index, 1);
		}
	};
	this.setEventServer = function(id) {
		if (EventServers[that.eventserverid] !== undefined) {
			EventServers[that.eventserverid].unassignFromEvent();
		}
		if (id === 0 || EventServers[id] === undefined) {
			that.eventserverid = 0;
		} else {
			EventServers[id].assignEvent(that.id);
			that.eventserverid = id;
		}
	};
	this.setPartecipants = function(partecipants) {
		that.partecipants = [];
		for (var i in partecipants) {
			if (partecipants[i][0] === "P") {
				if (Players[partecipants[i]] !== undefined) {
					that.partecipants.push(partecipants[i]);
					if (Database[partecipants[i]].events[that.id] === undefined) {
						Database[partecipants[i]].addEvent(that.id);
					}
				}
			} else if (partecipants[i][0] === "T") {
				if (Teams[partecipants[i]] !== undefined) {
					that.partecipants.push(partecipants[i]);
					var teamPlayers = Teams[partecipants[i]].players;
					for (var j in teamPlayers) {
						if (Database[teamPlayers[j]].events[that.id] === undefined) {
							Database[teamPlayers[j]].addEvent(that.id);
						}
					}
				}
			}
		}
	}
	this.getPlayers = function() {
		var ids = [];
		for (var i in that.partecipants) {
			if (that.partecipants[i][0] === "P") {
				ids.push(that.partecipants[i]);
			} else if (that.partecipants[i][0] === "T") {
				if (Teams[that.partecipants[i]] !== undefined) {
					var teamPlayers = Teams[that.partecipants[i]].players;
					for (var j in teamPlayers) {
						ids.push(teamPlayers[j]);
					}
				} else {
					console.log(that.partecipants[i] + " does not exist! [getConnectedIDs]");
				}
			}
		}
		return ids;
	};
	this.getConnectedIDs = function() {
		var ids = that.partecipants.slice();
		ids.push(that.id);
		for (var i in that.partecipants) {
			if (that.partecipants[i][0] === "T") {
				if (Teams[that.partecipants[i]] !== undefined) {
					var teamPlayers = Teams[that.partecipants[i]].players;
					for (var j in teamPlayers) {
						ids.push(teamPlayers[j]);
					}
				} else {
					console.log(that.partecipants[i] + " does not exist! [getConnectedIDs]");
				}
			}
		}
		return ids;
	};
	this.objectChanged = function(id) {
		var ids = that.getConnectedIDs();
		if (ids.indexOf(id) !== -1) {
			that.sendUserData();
		}
	};
	this.sendUserData = function() {
		var users = {};
		var users2 = {};
		for (var i in that.partecipants) {
			if (that.partecipants[i][0] === "P") {
				users[that.partecipants[i]] = Players[that.partecipants[i]].nicknames;

				if (Database[that.partecipants[i]].events[that.id] === undefined) {
					Database[that.partecipants[i]].addEvent(that.id);
				}

				users2[that.partecipants[i]] = {
					"id" : that.partecipants[i],
					"username" : Players[that.partecipants[i]].username,
					"image" : Players[that.partecipants[i]].image,
					"data" : Database[that.partecipants[i]].events[that.id]
				};
			} else if (that.partecipants[i][0] === "T") {
				var teamPlayers = Teams[that.partecipants[i]].players;
				for (var j in teamPlayers) {
					users[teamPlayers[j]] = Players[teamPlayers[j]].nicknames;

					if (Database[teamPlayers[j]].events[that.id] === undefined) {
						Database[teamPlayers[j]].addEvent(that.id);
					}

					users2[teamPlayers[j]] = {
						"id" : teamPlayers[j],
						"username" : Players[teamPlayers[j]].username,
						"image" : Players[teamPlayers[j]].image,
						"data" : Database[teamPlayers[j]].events[that.id]
					};
				}
			}
		}
		if (that.eventserverid !== 0) {
			EventServerSockets[that.eventserverid].emit("updateusers", {"id" : that.id, "players" : users});
		}
		serviceSocket.in(that.id).emit("updateplayers", users2);
	};

	this.setEventServer(this.eventserverid);
	this.setPartecipants(partecipants);
}

function removePartecipantFromEvent(id) {
	if (id === undefined) return;
	for (var i in Events) {
		if (Events[i] !== undefined) {
			Events[i].removePartecipant(id);
			Events[i].sendUserData();
		}
	}
}

// SOCKET SETUP
function sendData(socket) {
	if (socket !== undefined) {
		socket.emit("data", {"players" : Players, "teams" : Teams, "events" : Events, "eventservers" : EventServers});
	} else {
		io.sockets.emit("data", {"players" : Players, "teams" : Teams, "events" : Events, "eventservers" : EventServers});
	}
}
io.sockets.on("connection", function(socket) {
	sendData(socket);

	socket.on("updateobject", function(data) {
		if (data.type === "player") {
			if (data.username !== undefined) {
				//data.username = sanitizer.escape(data.username);
			}
			// Create Player
			if (data.id === undefined || Players[data.id] === undefined) {
				var newPlayer = new Player(data.username, data.image, data.team, data.nicknames);
				if (newPlayer.team !== undefined && newPlayer.team !== 0) {
					console.log("created", newPlayer.team, newPlayer.id);
					updateEventServers(newPlayer.id);
					//updatePlayerChangesRankings(newPlayer.id);
				}
			} else {
				// Update Player
				if (data.team !== undefined && data.team !== Players[data.id].team) {
					if (data.team === 0) {
						Players[data.id].changeTeam(undefined);
					} else {
						Players[data.id].changeTeam(data.team);
					}
				}
				Players[data.id].username = data.username || Players[data.id].username;
				Players[data.id].nicknames = data.nicknames || Players[data.id].nicknames;

				if (data.image !== undefined && Players[data.id].image !== undefined) {
					var filetodelete = Players[data.id].image+"";
					fs.unlink("public/img/uploads/"+filetodelete, function(err){
			      if (err) {
			        console.log('File could not be deleted: '+filetodelete);
			      } else {
			        console.log('File deleted: '+filetodelete);
			      };
			    });
				}
				Players[data.id].image = data.image || Players[data.id].image;
				//console.log(Players[data.id]);
				updateEventServers(data.id);
			}
		} else if (data.type === "team") {
			if (data.name !== undefined) {
				//data.name = sanitizer.escape(data.name);
			}
			// Create Team
			if (data.id === undefined || Teams[data.id] === undefined) {
				var newTeam = new Team(data.name, data.color, data.players);
				updateEventServers(newTeam.id);
			} else {
				// Update Team
				Teams[data.id].name = data.name || Teams[data.id].name;
				Teams[data.id].color = data.color || Teams[data.id].color;
				if (data.players !== undefined) {
					Teams[data.id].setPlayers(data.players);
				}
				updateEventServers(data.id);
			}
		} else if (data.type === "event") {
			if (data.name !== undefined) {
				//data.name = sanitizer.escape(data.name);
			}
			// Create Event
			if (data.id === undefined || Events[data.id] === undefined) {

				if (data.eventserverid !== undefined) {
					if (EventServers[data.eventserverid] !== undefined && EventServers[data.eventserverid].assignedeventid !== 0) {
						var oldeventid = EventServers[data.eventserverid].assignedeventid;
						Events[oldeventid].setEventServer(0);
						//console.log("Server has an event alredy, removing it: " + oldeventid);
					}
				}
				var newEvent = new Event(data.name, data.partecipants, data.eventserverid, data.rounds, data.warmupround);
				updateEventServers(newEvent.id);
			} else {
				// Update Event
				Events[data.id].name = data.name || Events[data.id].name;
				Events[data.id].rounds = data.rounds || Events[data.id].rounds;
				Events[data.id].warmupround = data.warmupround !== undefined ? data.warmupround : Events[data.id].warmupround;
				if (data.partecipants !== undefined) {
					Events[data.id].setPartecipants(data.partecipants);
					//console.log("partecipants of "+data.id, data.partecipants)
				}
				if (data.eventserverid !== undefined && Events[data.id].eventserverid !== data.eventserverid) {
					if (EventServers[data.eventserverid] !== undefined && EventServers[data.eventserverid].assignedeventid !== 0) {
						var oldeventid = EventServers[data.eventserverid].assignedeventid;
						Events[oldeventid].setEventServer(0);
						//console.log("Server has an event alredy, removing it: " + oldeventid);
					}
					Events[data.id].setEventServer(data.eventserverid);
					//console.log("Changing eventserverid: "+data.eventserverid);
				}
				updateEventServers(data.id);
			}
		}
		sendData();
	});

	socket.on("deleteobject", function(data) {
		if (data.id === undefined || data.id.length === 0) return;

		console.log("deleteobject: "+data.id);

		if (data.id[0] === "P") {
			if (Players[data.id] !== undefined) {
				if (Players[data.id].image !== undefined) {
					var filetodelete = Players[data.id].image+"";
					fs.unlink("public/img/uploads/"+filetodelete, function(err){
			      if (err) {
			        console.log('File could not be deleted: '+filetodelete);
			      } else {
			        console.log('File deleted: '+filetodelete);
			      };
			    });
				}
				Players[data.id].changeTeam(undefined);
			}
			Players[data.id] = undefined;
			Database[data.id] = undefined;
			removePartecipantFromEvent(data.id);
		} else if (data.id[0] === "T") {
			Teams[data.id].removeAllPlayers();
			Teams[data.id] = undefined;
			removePartecipantFromEvent(data.id);
		} else if (data.id[0] === "E") {
			Events[data.id].setEventServer(0);
			Events[data.id] = undefined;
		}
		sendData();
		updateEventServers(data.id);
	});

	socket.on("loadrawdata", function(data) {
		for (var i in EventServers) {
			EventServers[i].unassignFromEvent();
		}
		Players = {};
		Teams = {};
		Events = {};
		if (data.players !== undefined) {
			for (var i in data.players) {
				var newPlayer = new Player(data.players[i].username, data.players[i].image, data.players[i].team, data.players[i].nicknames, data.players[i].id);
			}
		}
		if (data.teams !== undefined) {
			for (var i in data.teams) {
				var newTeam = new Team(data.teams[i].name, data.teams[i].color, data.teams[i].players, data.teams[i].id);
			}
		}
		if (data.events !== undefined) {
			for (var i in data.events) {
				var newEvent = new Event(data.events[i].name, data.events[i].partecipants, 0, data.events[i].rounds, data.events[i].warmupround, data.events[i].id);
			}
		}
		sendData();
	});

	socket.on("getdatabase", function() {
		socket.emit("database", Database);
	});

	var delivery = dl.listen(socket);
  delivery.on('receive.success',function(file) {
    fs.writeFile("public/img/uploads/"+file.uid, file.buffer, function(err){
      if (err) {
        console.log('File could not be saved: '+file.uid);
      } else {
        console.log('File saved: '+file.uid);
      };
    });
  });

});


var pub = __dirname + '/public';
var path = require('path');
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
// WEB SETUP
app.get("/", function(req, res) {
	res.render("index");
});
app.get("/:id", function(req, res) {
	res.render('rankings', {id: req.params.id, title: config.title, logo: config.logo, stripes: config.stripes, background: config.background});
});

app.get('/img/uploads/*', function(req, res){
	path = req.params[0];
	if (path) {
		res.sendFile(path, {root: './public/img/uploads/'},
			function (err) {
	    if (err) {
				res.sendFile(__dirname + "/public/img/default_player.png");
	    }
		});
	} else {
		res.sendFile(__dirname + "/public/img/default_player.png");
	}
});

server.listen(80, "0.0.0.0");

// SERVICE SERVER
var EventServers = {};
var EventServerSockets = {};
function EventServer(id, socket) {
	this.eventserverid = id;
	this.assignedeventid = 0;
	this.servedrounds = 0;
	this.roundstarted = false;
	EventServerSockets[this.eventserverid] = socket;
	EventServerSockets[this.eventserverid].eventserverid = id;
	var that = this;

	this.assignEvent = function(id) {
		if (that.assignedeventid !== 0) that.unassignFromEvent();
		that.assignedeventid = id;
		that.servedrounds = 0;
		EventServerSockets[that.eventserverid].emit("seteventid", {"id" : that.assignedeventid, "name" : Events[that.assignedeventid].name});
		Events[id].sendUserData();
	};
	this.unassignFromEvent = function() {
		if (that.assignedeventid === 0) return;
		EventServerSockets[that.eventserverid].emit("unseteventid", {"id" : that.assignedeventid, "name" : Events[that.assignedeventid].name});
		that.assignedeventid = 0;
	};
}

function updateEventServers(id) {
	for (var i in Events) {
		if (Events[i] !== undefined) {
			Events[i].objectChanged(id);
		}
	}

	var rankings = {};
	for(var playerid in Players){
		if (Players[playerid] === undefined) {
			continue;
		}
		rankings[playerid] = {
			"id" : playerid,
			"username" : Players[playerid].username,
			"image" : Players[playerid].image,
			"data" : Database[playerid].data
		}
	}
	serviceSocket.in("rankings").emit("updateplayers", rankings);
}

// SERVICE PORT
var serviceApp = express();
serviceApp.use("/", express.static(__dirname + '/client'));
serviceApp.get("/", function(req, res) {
	res.sendFile(__dirname + "/client/index.html");
});

var serviceServer = require("http").createServer(serviceApp);
var serviceSocket = require('socket.io').listen(serviceServer);

serviceSocket.on("connection", function(socket) {
	//console.log("Client connected to ServiceSocket.");
	socket.on('joinevent', function(eventid) {
		if (Events[eventid] === undefined && eventid !== "rankings") return;
		socket.join(eventid);

		var rankings = {};
		if (eventid === "rankings") {
			for(var playerid in Players){
				if (Players[playerid] === undefined) {
					continue;
				}
				rankings[playerid] = {
					"id" : playerid,
					"username" : Players[playerid].username,
					"image" : Players[playerid].image,
					"data" : Database[playerid].data
				}
			}
		} else {
			var players = Events[eventid].getPlayers();
			for(var i in players){
				if (Players[players[i]] === undefined) {
					continue;
				}
				rankings[players[i]] = {
					"id" : players[i],
					"username" : Players[players[i]].username,
					"image" : Players[players[i]].image,
					"data" : Database[players[i]].events[eventid]
				}
			}
		}

		socket.emit("updateplayers", rankings);
	});
	socket.on("registeraseventserver", function(data) {
		if (EventServers[data.id] === undefined) {
			console.log("EventServer registered: " + data.id);
		} else {
			var cont = 2;
			while (true) {
				if (EventServers[data.id+"_"+cont] === undefined) {
					data.id = data.id+"_"+cont;
					console.log("EventServer registered: " + data.id);
					socket.emit("updateserverid", {"id" : data.id});
					break;
				}
				cont++;
			}
		}
		var newEventServer = new EventServer(data.id, socket);
		EventServers[data.id] = newEventServer;
		sendData();

		socket.on("roundstart", function() {
			var eventid = EventServers[socket.eventserverid].assignedeventid;
			var servedrounds = EventServers[socket.eventserverid].servedrounds;

			if (eventid !== 0) {
				if (Events[eventid].warmupround && servedrounds === 0) {
					console.log("EventServer warmup round started: " + socket.eventserverid);
				} else {
					console.log("EventServer round " + servedrounds + " started: " + socket.eventserverid);
				}
			} else {
				console.log("EventServer round started: " + socket.eventserverid);
			}
			EventServers[socket.eventserverid].roundstarted = true;

			if (eventid !== 0) {
				serviceSocket.in(eventid).emit("roundstarted");
			}
		});

		socket.on("updateonplayersdata", function(data) {
			var eventid = EventServers[socket.eventserverid].assignedeventid;
			var servedrounds = EventServers[socket.eventserverid].servedrounds;

			if (Events[eventid].warmupround && servedrounds === 0) {
				console.log("EventServer sent players data: ignoring them. (Warmup round)");
			} else {
				console.log("EventServer sent players data: " + socket.eventserverid);
				console.log(data.players);
				serviceSocket.in(data.eventid).emit("updateranking", {players: data.players});
				serviceSocket.in("rankings").emit("updateranking", {players: data.players});
				updateDatabase(data);
			}
		});

		socket.on("roundend", function() {
			var eventid = EventServers[socket.eventserverid].assignedeventid;
			var servedrounds = EventServers[socket.eventserverid].servedrounds;

			if (eventid !== 0) {
				if (Events[eventid].warmupround && servedrounds === 0) {
					console.log("EventServer warmup round ended: " + socket.eventserverid);
				} else {
					console.log("EventServer round " + servedrounds + " ended: " + socket.eventserverid);
				}
			} else {
				console.log("EventServer round ended: " + socket.eventserverid);
			}

			if (eventid !== 0) {
				serviceSocket.in(eventid).emit("roundended");
			}
			EventServers[socket.eventserverid].servedrounds++;
			servedrounds = EventServers[socket.eventserverid].servedrounds;

			if (eventid !== 0) {
				var maxrounds = Events[eventid].rounds;
				if (Events[eventid].warmupround) maxrounds++;
				// Unassign event only if the event ended (all rounds have been played)
				if (servedrounds >= maxrounds) {
					if (Events[EventServers[socket.eventserverid].assignedeventid] !== undefined) {
						Events[EventServers[socket.eventserverid].assignedeventid].setEventServer(0);
						sendData();
						console.log("Event ended: " + eventid);
					}
				}
			}
			EventServers[socket.eventserverid].roundstarted = false;
		});

		socket.on("disconnect", function() {
			if (EventServers[socket.eventserverid] !== undefined) {
				if (Events[EventServers[socket.eventserverid].assignedeventid] !== undefined) {
					Events[EventServers[socket.eventserverid].assignedeventid].setEventServer(0);
				}
			}
			console.log("EventServer disconnected: " + socket.eventserverid);
			EventServers[socket.eventserverid] = undefined;
			EventServerSockets[socket.eventserverid] = undefined;
			sendData();
		});
	});

});
serviceServer.listen(3000, "0.0.0.0");
