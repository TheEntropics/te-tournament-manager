var express = require("express");
var crypto = require("crypto");
var fs = require('fs');
var sanitizer = require('sanitizer');

var app = express();
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);

io.set('origins', '*:80');

// SETUP
console.log("TheEntropics Mastererver v0.0.1");

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log();
console.log("Title: " + config.title);
console.log();

var Players = {};
var Teams = {};
var Events = {};

// DATABASE
var Database = {};
function PlayerRecord(id) {
	this.id = id;

	this.kills = 0;
	this.deaths = 0;
	this.headshots = 0;
	this.knives = 0;
	this.kamikaze = 0;
	this.killstreak = 0;

	this.events = {};
	var that = this;
	this.updateKills = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.kills += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].kills += n;
	};

	this.updateDeaths = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.deaths += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].deaths += n;
	};

	this.updateHeadshots = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.headshots += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].headshots += n;
	};

	this.updateKnives = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.knives += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].knives += n;
	};

	this.updateKamikaze = function(n, eventid) {
		if (n === undefined || n === 0) return;
		that.kamikaze += n;
		if (eventid === undefined) return;
		if (that.events[eventid] === undefined) {
			that.addEvent(eventid);
		}
		that.events[eventid].kamikaze += n;
	};

	this.updateKillstreak = function(n, eventid) {
		if (n === undefined || n === 0) return;
		if (that.killstreak < n) {
			that.killstreak = n;
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
	this.image = image;
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

function Event(name, partecipants, eventserverid, rawid) {
	this.id = rawid || "E"+getNewID();
	this.type = "event";
	this.name = name;
	this.partecipants = [];
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
				}
			} else if (partecipants[i][0] === "T") {
				if (Teams[partecipants[i]] !== undefined) {
					that.partecipants.push(partecipants[i]);
				}
			}
		}
	}
	this.setEventServer(this.eventserverid);
	this.setPartecipants(partecipants);
}

function removePartecipantFromEvent(id) {
	if (id === undefined) return;
	for (var i in Events) {
		if (Events[i] !== undefined) {
			Events[i].removePartecipant(id);
			if (Events[i].eventserverid !== undefined && EventServers[Events[i].eventserverid] !== undefined) {
				EventServers[Events[i].eventserverid].sendUserData();
			}
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
					updateEventServers(newPlayer.id);
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
				var newEvent = new Event(data.name, data.partecipants, data.eventserverid);
				updateEventServers(newEvent.id);
			} else {
				// Update Event
				Events[data.id].name = data.name || Events[data.id].name;
				if (data.partecipants !== undefined) {
					Events[data.id].setPartecipants(data.partecipants);
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
		console.log("deleteobject: "+data.id+" "+data.type);
		if (data.type === "player") {
			if (Players[data.id] !== undefined) {
				Players[data.id].changeTeam(undefined);
			}
			Players[data.id] = undefined;
			removePartecipantFromEvent(data.id);
		} else if (data.type === "team") {
			Teams[data.id].removeAllPlayers();
			Teams[data.id] = undefined;
			removePartecipantFromEvent(data.id);
		} else if (data.type === "event") {
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
				var newEvent = new Event(data.events[i].name, data.events[i].partecipants, 0, data.events[i].id);
			}
		}
		sendData();
	});
});

// WEB SETUP
app.use("/", express.static(__dirname + '/client'));
app.get("/", function(req, res) {
	res.sendFile(__dirname + "/client/index.html");
});

server.listen(80, "0.0.0.0");

// SERVICE SERVER
var EventServers = {};
var EventServerSockets = {};
function EventServer(id, socket) {
	this.eventserverid = id;
	this.assignedeventid = 0;
	this.roundstarted = false;
	EventServerSockets[this.id] = socket;
	EventServerSockets[this.id].eventserverid = id;
	var that = this;

	this.assignEvent = function(id) {
		if (that.assignedeventid !== 0) that.unassignFromEvent();
		that.assignedeventid = id;
		EventServerSockets[that.id].emit("seteventid", {"id" : that.assignedeventid, "name" : Events[that.assignedeventid].name});
		that.sendUserData();
	};
	this.unassignFromEvent = function() {
		if (that.assignedeventid === 0) return;
		EventServerSockets[that.id].emit("unseteventid", {"id" : that.assignedeventid, "name" : Events[that.assignedeventid].name});
		that.assignedeventid = 0;
	};
	this.getConnectedIDs = function() {
		if (that.assignedeventid === 0) return [];
		var ids = Events[that.assignedeventid].partecipants.slice();
		var partecipants = Events[that.assignedeventid].partecipants;
		for (var i in partecipants) {
			if (partecipants[i][0] === "T") {
				if (Teams[partecipants[i]] !== undefined) {
					var teamPlayers = Teams[partecipants[i]].players;
					for (var j in teamPlayers) {
						ids.push(teamPlayers[j]);
					}
				} else {
					console.log(partecipants[i] + " does not exist! [getConnectedIDs]");
				}
			}
		}
		ids.push(that.assignedeventid);
		return ids;
	};
	this.objectChanged = function(id) {
		var ids = that.getConnectedIDs();
		if (ids.indexOf(id) !== -1) {
			that.sendUserData();
		}
	};
	this.sendUserData = function() {
		if (that.assignedeventid === 0) return;
		var partecipants = Events[that.assignedeventid].partecipants;
		var users = {};
		for (var i in partecipants) {
			if (partecipants[i][0] === "P") {
				users[partecipants[i]] = Players[partecipants[i]].nicknames;
			} else if (partecipants[i][0] === "T") {
				var teamPlayers = Teams[partecipants[i]].players;
				for (var j in teamPlayers) {
					users[teamPlayers[j]] = Players[teamPlayers[j]].nicknames;
				}
			}
		}
		EventServerSockets[that.id].emit("updateusers", {"id" : that.assignedeventid, "players" : users});
	};
}

function updateEventServers(id) {
	for (var i in EventServers) {
		if (EventServers[i] !== undefined) {
			EventServers[i].objectChanged(id);
		}
	}
}

var serviceApp = express();
serviceApp.use("/", express.static(__dirname + '/client'));
serviceApp.get("/", function(req, res) {
	res.sendFile(__dirname + "/client/index.html");
});

var serviceServer = require("http").createServer(serviceApp);
var serviceSocket = require('socket.io').listen(serviceServer);
serviceSocket.on("connection", function(socket) {
	//console.log("Client connected to ServiceSocket.");
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
			console.log("EventServer round started: " + socket.eventserverid);
			EventServers[socket.eventserverid].roundstarted = true;
		});

		socket.on("updateonplayersdata", function(data) {
			console.log("EventServer sent players data: " + socket.eventserverid);
			console.log(data.players);
			updateDatabase(data);
		});

		socket.on("roundend", function() {
			console.log("EventServer round ended: " + socket.eventserverid);
			if (EventServers[socket.eventserverid].roundstarted) {
				// Unassign event only if the round was started
				Events[EventServers[socket.eventserverid].assignedeventid].setEventServer(0);
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
