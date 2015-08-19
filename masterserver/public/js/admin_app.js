function setPreview(input, imageview) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      imageview.attr('src', e.target.result);
    }
    reader.readAsDataURL(input.files[0]);
  }
}

angular.module("adminPage", [])

	.factory('socket', function ($rootScope) {
	  var socket = io.connect(document.location.href);
	  return {
	    on: function (eventName, callback) {
	      socket.on(eventName, function () {
	        var args = arguments;
	        $rootScope.$apply(function () {
	          callback.apply(socket, args);
	        });
	      });
	    },
	    emit: function (eventName, data, callback) {
	      socket.emit(eventName, data, function () {
	        var args = arguments;
	        $rootScope.$apply(function () {
	          if (callback) {
	            callback.apply(socket, args);
	          }
	        });
	      })
	    }
	  };
	})

	.controller('MainController', [
		'$scope',
		'$rootScope',
		'$window',
		'socket',

		function ($scope, $root, $window, socket) {

			var delivery = new Delivery(socket);
		  var deliveryCallback;

		  delivery.on('send.success', function(fileUID) {
		    console.log("file was successfully sent.");
		    if (deliveryCallback !== undefined) {
		      deliveryCallback(fileUID);
		    }
		    deliveryCallback = undefined;
		  });

			$scope.players = {};
			$scope.teams = {};
			$scope.events = {};
			$scope.servers = {};

			// Views
			var playerModal;
			var teamModal;
			var eventModal;
			var settingsModal;

			playerModal = $("#create-player-modal");
		  teamModal = $("#create-team-modal");
			teamModal.find(".colorpickerinput").colorpicker();
		  eventModal = $("#create-event-modal");
			settingsModal = $("#settings-modal");

			settingsModal.find("#save").on("click", function() {
		    var string = JSON.stringify({"players" : $scope.players, "teams" : $scope.teams, "events" : $scope.events}, null, 2);
		    settingsModal.find("#data").val(string);
		  });

		  settingsModal.find("#load").on("click", function() {
		    var string = settingsModal.find("#data").val();
		    var data = JSON.parse(string);
		    if (data.players === undefined || data.teams === undefined || data.events === undefined) return;
		    socket.emit("loadrawdata", data);
		  });

		  settingsModal.find("#save-database").on("click", function() {
		    /*var string = JSON.stringify({"players" : players, "teams" : teams, "events" : events}, null, 2);
		    settingsModal.find("#data").val(string);*/
		    socket.emit("getdatabase");
		    socket.on("database", function(data) {
		      var database = data;
		      var string = JSON.stringify(database, null, 2);
		      settingsModal.find("#data").val(string);
		    });
		  });

			playerModal.find("#player-image-input").change(function(){
		    setPreview(this, playerModal.find("#player-image"));
		  });

			$scope.showCreatePlayerModal = function(id) {

			  var teamsListModal = playerModal.find("#create-player-modal-teams-list");
			  if (id === undefined) {

			    playerModal.find("#username").val("");
			    playerModal.find("#nicknames").val("");
			    playerModal.find("#player-image-form")[0].reset();
			    playerModal.find("#player-image").attr("src", "img/default_player.png");
			    playerModal.find("#save-player").off("click");
			    playerModal.find("#save-player").on("click", function() {
			      playerModal.modal('hide');
			      var username = playerModal.find("#username").val();
			      var teamid = teamsListModal.children(".active").data("team-id");
			      var nicknames = playerModal.find("#nicknames").val().split("\n");
			      var filename = playerModal.find("#player-image-input")[0].files[0];
			      playerModal.find("#username").val("");

			      console.log("create player: "+username+", new team "+teamid);
			      console.log(filename);

			      if (filename === undefined) {
			        socket.emit("updateobject", {"type" : "player", "username" : username, "team" : teamid, "nicknames" : nicknames});
			      } else {
			        deliveryCallback = function(fileUID) {
			          console.log("file was successfully sent. [AddPlayer]");
			          socket.emit("updateobject", {"type" : "player", "username" : username, "team" : teamid, "nicknames" : nicknames, "image" : fileuid});
			        };
			        var fileuid = delivery.send(filename);
			      }

			    });

			  } else {

			    console.log("edit player: "+id+" "+$scope.players[id].username);

			    playerModal.find("#username").val($scope.players[id].username);
			    playerModal.find("#player-image-form")[0].reset();

			    if ($scope.players[id].image !== undefined) {
			      playerModal.find("#player-image").attr("src", "img/uploads/"+$scope.players[id].image);
			    } else {
			      playerModal.find("#player-image").attr("src", "img/uploads/default");
			    }

			    var nicknames = "";
			    for (var k = 0; k < $scope.players[id].nicknames.length; k++) {
			      if (k === $scope.players[id].nicknames.length - 1) {
			        nicknames += $scope.players[id].nicknames[k];
			      } else {
			        nicknames += $scope.players[id].nicknames[k] + "\n";
			      }
			    }
			    playerModal.find("#nicknames").val(nicknames);

			    playerModal.find("#save-player").off("click");
			    playerModal.find("#save-player").on("click", function() {
			      playerModal.modal('hide');
			      var username = playerModal.find("#username").val();
			      var teamid = teamsListModal.children(".active").data("team-id");
			      var filename = playerModal.find("#player-image-input")[0].files[0];
			      var nicknames = playerModal.find("#nicknames").val().split("\n");
			      for (var k = 0; k < nicknames.length; k++) {
			        if (nicknames[k] === "") {
			          nicknames.splice(k, 1);
			        }
			      }
			      playerModal.find("#username").val("");
			      console.log("save player: "+id+" "+$scope.players[id].username+" as "+username+", new team "+teamid);
			      console.log(filename);

			      if (filename === undefined) {
			        socket.emit("updateobject", {"type" : "player", "id" : id, "username" : username, "team" : teamid, "nicknames" : nicknames});
			      } else {
			        deliveryCallback = function(fileUID) {
			          console.log("file was successfully sent. [EditPlayer]");
			          socket.emit("updateobject", {"type" : "player", "id" : id, "username" : username, "team" : teamid, "nicknames" : nicknames, "image" : fileuid});
			        };
			        var fileuid = delivery.send(filename);
			      }
			    });
			  }

			  teamsListModal.html("");
			  var item = $("<button type=\"button\" class=\"list-group-item\">No team</button>");
			  teamsListModal.append(item);
			  item.addClass("active");
			  item.data("team-id", 0);
			  item.on("click", function() {
			    teamsListModal.children().removeClass("active");
			    $(this).addClass("active");
			  });

			  for (var j in $scope.teams) {
			    var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
			    item.html($scope.teams[j].name);
			    var badge = $("<span class=\"badge\">Color</span>");
			    badge.css("background-color", $scope.teams[j].color);
			    item.append(badge);
			    item.data("team-id", j);
			    teamsListModal.append(item);
			    item.on("click", function() {
			      teamsListModal.children().removeClass("active");
			      $(this).addClass("active");
			    });
			    if (id !== undefined && $scope.players[id].team === j) {
			      teamsListModal.children().removeClass("active");
			      item.addClass("active");
			    }
			  }

			  playerModal.modal('show');
			}

			$scope.showCreateTeamModal = function(id) {

			  if (id === undefined) {
			    teamModal.find("#teamname").val("");
			    teamModal.find("#teamcolor").val("#ffffff");

			    teamModal.find("#save-team").off("click");
			    teamModal.find("#save-team").on("click", function() {
			      teamModal.modal('hide');
			      var teamname = teamModal.find("#teamname").val();
			      var teamcolor = teamModal.find("#teamcolor").val();

			      console.log("create team: "+teamname+", color "+teamcolor);

			      socket.emit("updateobject", {"type" : "team", "name" : teamname, "color" : teamcolor});
			    });

			  } else {
			    console.log("edit team");

			    teamModal.find("#teamname").val($scope.teams[id].name);
			    teamModal.find("#teamcolor").val($scope.teams[id].color);

			    teamModal.find("#save-team").off("click");
			    teamModal.find("#save-team").on("click", function() {
			      teamModal.modal('hide');
			      var teamname = teamModal.find("#teamname").val();
			      var teamcolor = teamModal.find("#teamcolor").val();

			      console.log("create team: "+teamname+", color "+teamcolor);

			      socket.emit("updateobject", {"type" : "team", "id" : id, "name" : teamname, "color" : teamcolor});
			    });
			  }

			  teamModal.modal('show');
			}

			$scope.showCreateEventModal = function(id) {

			  var teamsListModal = eventModal.find("#create-event-modal-teams-list");
			  var playersListModal = eventModal.find("#create-event-modal-players-list");
			  var serversListModal = eventModal.find("#create-event-modal-servers-list");

			  eventModal.find("#save-event").off("click");

			  if (id === undefined) {

			    eventModal.find("#eventname").val("");
			    eventModal.find("#rankings").hide();
			    eventModal.find("#rounds").val("1");
			    eventModal.find("#warmupround").attr("checked", false);

			    eventModal.find("#save-event").on("click", function() {
			      eventModal.modal('hide');
			      var eventname = eventModal.find("#eventname").val();
			      var eventserverid = serversListModal.children(".active").data("server-id");
			      var teamsSelected = teamsListModal.find(".active");
			      var playersSelected = playersListModal.find(".active");
			      var rounds = eventModal.find("#rounds").val();
			      var warmupround = eventModal.find("#warmupround").is(':checked');

			      var partecipants = [];
			      teamsSelected.each(function() {
			        partecipants.push($(this).data("team-id"));
			      });
			      playersSelected.each(function() {
			        partecipants.push($(this).data("player-id"));
			      });

			      console.log("create event: "+eventname);

			      socket.emit("updateobject", {"type" : "event", "name" : eventname, "partecipants" : partecipants, "eventserverid" : eventserverid, "rounds" : rounds, "warmupround" : warmupround});
			    });

			  } else {

			    console.log("edit event");

			    eventModal.find("#eventname").val($scope.events[id].name);
			    eventModal.find("#rounds").val($scope.events[id].rounds);
			    eventModal.find("#warmupround").attr("checked", $scope.events[id].warmupround);
			    eventModal.find("#rankings").show();
			    eventModal.find("#show-rankings").attr("href", "/"+id);

			    eventModal.find("#save-event").off("click");
			    eventModal.find("#save-event").on("click", function() {
			      eventModal.modal('hide');
			      var eventname = eventModal.find("#eventname").val();
			      var eventserverid = serversListModal.children(".active").data("server-id");
			      var teamsSelected = teamsListModal.find(".active");
			      var playersSelected = playersListModal.find(".active");
			      var rounds = eventModal.find("#rounds").val();
			      var warmupround = eventModal.find("#warmupround").is(':checked');

			      var partecipants = [];
			      teamsSelected.each(function() {
			        partecipants.push($(this).data("team-id"));
			      });
			      playersSelected.each(function() {
			        partecipants.push($(this).data("player-id"));
			      });

			      console.log("create event: "+eventname);

			      socket.emit("updateobject", {"type" : "event", "id" : id, "name" : eventname, "partecipants" : partecipants, "eventserverid" : eventserverid, "rounds" : rounds});
			    });
			  }

			  var tempids = {};
			  if (id !== undefined) {
			    for (var n in $scope.events[id].partecipants) {
			      tempids[$scope.events[id].partecipants[n]] = $scope.events[id].partecipants[n];
			    }
			  }
			  // Show teams
			  var cont = 0;
			  teamsListModal.html("");
			  for (var j in $scope.teams) {
			    cont++;
			    var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
			    item.html($scope.teams[j].name);
			    var badge = $("<span class=\"badge\">Color</span>");
			    badge.css("background-color", $scope.teams[j].color);
			    item.append(badge);
			    item.data("team-id", j);
			    teamsListModal.append(item);
			    item.on("click", function() {
			      $(this).toggleClass("active");
			    });
			    if (tempids[j] !== undefined) {
			      item.addClass("active");
			    }
			  }
			  if (cont === 0) {
			    teamsListModal.html("<h6>No teams</h6>");
			  }

			  // Show players
			  playersListModal.html("");
			  cont = 0;
			  for (var j in $scope.players) {
			    cont++;
			    var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
			    item.html($scope.players[j].username);
			    item.data("player-id", j);
			    playersListModal.append(item);
			    item.on("click", function() {
			      $(this).toggleClass("active");
			    });
			    if (tempids[j] !== undefined) {
			      item.addClass("active");
			    }
			  }
			  if (cont === 0) {
			    playersListModal.html("<h6>No players</h6>");
			  }

			  // Show servers
			  serversListModal.html("");

			  var item = $("<button type=\"button\" class=\"list-group-item\">No server</button>");
			  serversListModal.append(item);
			  item.addClass("active");
			  item.data("server-id", 0);
			  item.on("click", function() {
			    serversListModal.children().removeClass("active");
			    $(this).addClass("active");
			  });

			  for (var j in $scope.servers) {
			    item = $("<button type=\"button\" class=\"list-group-item\"></button>");
			    item.html($scope.servers[j].eventserverid);
			    item.data("server-id", j);
			    serversListModal.append(item);
			    item.on("click", function() {
			      serversListModal.children().removeClass("active");
			      $(this).addClass("active");
			    });
			    if (id !== undefined && $scope.events[id].eventserverid === j) {
			      serversListModal.children().removeClass("active");
			      item.addClass("active");
			    }
			  }

			  eventModal.modal('show');
			}

			$scope.deleteObject = function(id) {
			  socket.emit("deleteobject", {"id" : id});
			}

			socket.on("data", function(data) {
		    console.log(data);
		    $scope.players = data.players;
		    $scope.teams = data.teams;
		    $scope.events = data.events;
		    $scope.servers = data.eventservers;
			});

		}
	]);
