function setPreview(input, imageview) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      imageview.attr('src', e.target.result);
    }
    reader.readAsDataURL(input.files[0]);
  }
}

var API = {};

angular.module("adminPage", [])

	.factory('socket', function ($rootScope) {
	  var socket = io.connect(document.location.href.split("/")[2]);
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
        playerModal.find("#player-image-form")[0].reset();

		    playerModal.find("#save-player").off("click");
		    playerModal.find("#save-player").on("click", function() {
		      playerModal.modal('hide');
		      var username = API.getCreatePlayerModalData().username;
		      var teamid = API.getCreatePlayerModalData().teamid;
		      var filename = playerModal.find("#player-image-input")[0].files[0];
		      var nicknames = API.getCreatePlayerModalData().nicknames.split("\n");
		      for (var k = 0; k < nicknames.length; k++) {
		        if (nicknames[k] === "") {
		          nicknames.splice(k, 1);
		        }
		      }
		      //console.log("save player: "+id+" "+$scope.players[id].username+" as "+username+", new team "+teamid);
		      //console.log(filename);

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

        API.setCreatePlayerModalData($scope.players[id], $scope.teams);
			  playerModal.modal('show');
			}

			$scope.showCreateTeamModal = function(id) {

		    console.log("edit team : " + id);

		    teamModal.find("#save-team").off("click");
		    teamModal.find("#save-team").on("click", function() {
		      teamModal.modal('hide');
		      var teamname = API.getCreateTeamModalData().name;
		      var teamcolor = API.getCreateTeamModalData().color;

		      console.log("create team: "+teamname+", color "+teamcolor);

		      socket.emit("updateobject", {"type" : "team", "id" : id, "name" : teamname, "color" : teamcolor});
		    });

        API.setCreateTeamModalData($scope.teams[id]);
			  teamModal.modal('show');
			}

			$scope.showCreateEventModal = function(id) {

			  var teamsListModal = eventModal.find("#create-event-modal-teams-list");
			  var playersListModal = eventModal.find("#create-event-modal-players-list");
			  var serversListModal = eventModal.find("#create-event-modal-servers-list");

        console.log("edit event");

        eventModal.find("#save-event").off("click");
        eventModal.find("#save-event").on("click", function() {
          eventModal.modal('hide');
          var eventname = API.getCreateEventModalData().name;
          var eventserverid = API.getCreateEventModalData().eventserverid;
          var partecipants = API.getCreateEventModalData().partecipants;
          var rounds = API.getCreateEventModalData().rounds;
          var warmupround = API.getCreateEventModalData().warmupround;

          console.log("create event: "+eventname);

          socket.emit("updateobject", {"type" : "event", "id" : id, "name" : eventname, "partecipants" : partecipants, "eventserverid" : eventserverid, "rounds" : rounds, "warmupround" : warmupround});
        });

        API.setCreateEventModalData($scope.events[id], $scope.teams, $scope.players, $scope.servers);
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
	])

  .controller('CreateUserModalController', [
		'$scope',
		'$rootScope',
		'$window',
		'socket',

		function ($scope, $root, $window, socket) {

			$scope.player = {"name" : "", "image" : "", "nicknames" : []};
      $scope.nicknames = "";
      $scope.teams = [
        {
          "name" : "No team",
          "id" : "0"
        }
      ];
      $scope.selectedTeam = "0";

      $scope.select = function($event) {
        $scope.selectedTeam = $($event.currentTarget).data("team-id");
      }

      $scope.setData = function(player, teams) {
        $scope.player.image = " ";
        $scope.player.username = (player !== undefined ? player.username+"" : "");
        $scope.player.image = (player !== undefined ? player.image+"" : "default");
        $scope.player.nicknames = (player !== undefined ? player.nicknames.slice() : []);

        $scope.selectedTeam = (player !== undefined ? player.team+"" : "0");
        $scope.teams = [
          {
            "name" : "No team",
            "id" : "0"
          }
        ];

        for (var team in teams) {
          $scope.teams.push(teams[team]);
        }

        $scope.nicknames = "";

        for (var i = 0; i < $scope.player.nicknames.length; i++) {
          if (i === $scope.player.nicknames.length - 1) {
            $scope.nicknames += $scope.player.nicknames[i];
          } else {
            $scope.nicknames += $scope.player.nicknames[i] + "\n";
          }
        }
      }

      $scope.getData = function() {
        return {"username" : $scope.player.username+"", "nicknames" : $scope.nicknames+"", "teamid" : $scope.selectedTeam+""};
      }

      API.setCreatePlayerModalData = $scope.setData;
      API.getCreatePlayerModalData = $scope.getData;
		}
	])

  .controller('CreateTeamModalController', [
		'$scope',
		'$rootScope',
		'$window',
		'socket',

		function ($scope, $root, $window, socket) {

      function getColor() {
        return ('#' + Math.floor(Math.random()*16777216).toString(16) );
      }

			$scope.team = { "name": "", "color" : getColor() };

      $scope.setData = function(team) {
        $scope.team.name = (team !== undefined ? team.name+"" : "");
        $scope.team.color = (team !== undefined ? team.color+"" : getColor());
      }

      $scope.getData = function() {
        return { "name": $scope.team.name, "color" : $scope.team.color };
      }

      API.setCreateTeamModalData = $scope.setData;
      API.getCreateTeamModalData = $scope.getData;
		}
	])

  .controller('CreateEventModalController', [
		'$scope',
		'$rootScope',
		'$window',
		'socket',

		function ($scope, $root, $window, socket) {

			$scope.event = {"name" : "", "rounds" : "1", "warmupround" : false, "partecipants" : [], "eventserverid" : "0"};
      $scope.teams = [];
      $scope.players = [];
      $scope.servers = [];

      $scope.partecipants = [];

      $scope.setData = function(event, teams, players, servers) {
        $scope.event.name = (event !== undefined ? event.name : "");
        $scope.event.id = (event !== undefined ? event.id : undefined);
        $scope.event.rounds = (event !== undefined ? event.rounds : "1");
        $scope.event.warmupround = (event !== undefined ? event.warmupround : false);
        $scope.event.partecipants = (event !== undefined ? event.partecipants.slice() : []);
        $scope.event.eventserverid = (event !== undefined ? event.eventserverid : "0");
        $scope.partecipants = (event !== undefined ? event.partecipants.slice() : []);

        $scope.teams = [];
        $scope.players = [];
        $scope.servers = [
          {"eventserverid" : "0"}
        ];

        for (var team in teams) {
          $scope.teams.push(teams[team]);
        }
        for (var player in players) {
          $scope.players.push(players[player]);
        }
        for (var server in servers) {
          $scope.servers.push(servers[server]);
        }
      }

      $scope.select = function($event) {
        $scope.event.eventserverid = $($event.currentTarget).data("eventserver-id");
      }

      $scope.toggle = function($event) {
        var id = $($event.currentTarget).data("object-id");
        var pos = $scope.partecipants.indexOf(id);
        if (pos !== -1) {
            $scope.partecipants.splice(pos, 1);
        } else {
          $scope.partecipants.push(id);
        }
       }

       $scope.isSelected = function(id) {
         var pos = $scope.partecipants.indexOf(id);
         return (pos !== -1);
       }

       $scope.getData = function() {
         return {"name" : $scope.event.name, "rounds" : $scope.event.rounds, "warmupround" : $scope.event.warmupround, "partecipants" : $scope.partecipants, "eventserverid" : $scope.event.eventserverid};
       }

      API.setCreateEventModalData = $scope.setData;
      API.getCreateEventModalData = $scope.getData;
		}
	]);
