var players = {};
var teams = {};
var events = {};
var servers = {};

var database = {};

function setPreview(input, imageview) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      imageview.attr('src', e.target.result);
    }
    reader.readAsDataURL(input.files[0]);
  }
}

$(document).ready(function() {

  var addPlayerBtn = $("#add-player");
  //var savePlayerBtn = $("#save-player");
  var addTeamBtn = $("#add-team");
  var addEventBtn = $("#add-event");

  var playersList = $("#players-list");
  var teamsList = $("#teams-list");
  var eventsList = $("#events-list");

  var playerModal = $("#create-player-modal");
  var teamModal = $("#create-team-modal");
  teamModal.find(".colorpickerinput").colorpicker();
  var eventModal = $("#create-event-modal");
  var settingsModal = $("#settings-modal");

  playerModal.find("#player-image-input").change(function(){
    setPreview(this, playerModal.find("#player-image"));
  });

  socket = io.connect(document.location.href); // "http://192.168.1.10:80"
  var delivery = new Delivery(socket);
  var deliveryCallback;
  /*delivery.on('delivery.connect', function(delivery) {
  });*/

  delivery.on('send.success', function(fileUID) {
    console.log("file was successfully sent.");
    if (deliveryCallback !== undefined) {
      deliveryCallback(fileUID);
    }
    deliveryCallback = undefined;
  });

  settingsModal.find("#save").on("click", function() {
    var string = JSON.stringify({"players" : players, "teams" : teams, "events" : events}, null, 2);
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
      database = data;
      var string = JSON.stringify(database, null, 2);
      settingsModal.find("#data").val(string);
    });
  });

  /*addPlayerBtn.on("click", function() {
    socket.emit("updateobject", {"type" : "player", "username" : "gion"});
  });*/
  addPlayerBtn.on("click", function() {
    var btn = $(this);
    var teamsListModal = playerModal.find("#create-player-modal-teams-list");

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

    teamsListModal.html("");
    var item = $("<button type=\"button\" class=\"list-group-item\">No team</button>");
    teamsListModal.append(item);
    item.addClass("active");
    item.data("team-id", 0);
    item.on("click", function() {
      teamsListModal.children().removeClass("active");
      $(this).addClass("active");
    });

    for (var j in teams) {
      var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
      item.html(teams[j].name);
      var badge = $("<span class=\"badge\">Color</span>");
      badge.css("background-color", teams[j].color);
      item.append(badge);
      item.data("team-id", j);
      teamsListModal.append(item);
      item.on("click", function() {
        teamsListModal.children().removeClass("active");
        $(this).addClass("active");
      });
    }

    playerModal.modal('show');
  });

  addTeamBtn.on("click", function() {

    teamModal.find("#teamname").val("");
    teamModal.find("#teamcolor").val("#ffffff");

    teamModal.find("#save-team").off("click");
    teamModal.find("#save-team").on("click", function() {
      teamModal.modal('hide');
      var teamname = teamModal.find("#teamname").val();
      var teamcolor = teamModal.find("#teamcolor").val();

      console.log("create team: "+teamname+", color "+teamcolor);

      socket.emit("updateobject", {"type" : "team", "name" : teamname, "color" : teamcolor});

      teamModal.find("#teamname").val("");
      teamModal.find("#teamcolor").val("#ffffff");
    });

    teamModal.modal('show');
  });

  addEventBtn.on("click", function() {
    var teamsListModal = eventModal.find("#create-event-modal-teams-list");
    var playersListModal = eventModal.find("#create-event-modal-players-list");
    var serversListModal = eventModal.find("#create-event-modal-servers-list");
    eventModal.find("#eventname").val("");
    eventModal.find("#rankings").hide();

    eventModal.find("#save-event").off("click");
    eventModal.find("#save-event").on("click", function() {
      eventModal.modal('hide');
      var eventname = eventModal.find("#eventname").val();
      var eventserverid = serversListModal.children(".active").data("server-id");
      var teamsSelected = teamsListModal.find(".active");
      var playersSelected = playersListModal.find(".active");

      var partecipants = [];
      teamsSelected.each(function() {
        partecipants.push($(this).data("team-id"));
      });
      playersSelected.each(function() {
        partecipants.push($(this).data("player-id"));
      });

      console.log("create event: "+eventname);

      socket.emit("updateobject", {"type" : "event", "name" : eventname, "partecipants" : partecipants, "eventserverid" : eventserverid});
    });

    // Show teams
    var cont = 0;
    teamsListModal.html("");
    for (var j in teams) {
      cont++;
      var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
      item.html(teams[j].name);
      var badge = $("<span class=\"badge\">Color</span>");
      badge.css("background-color", teams[j].color);
      item.append(badge);
      item.data("team-id", j);
      teamsListModal.append(item);
      item.on("click", function() {
        $(this).toggleClass("active");
      });
    }
    if (cont === 0) {
      teamsListModal.html("<h6>No teams</h6>");
    }

    // Show players
    playersListModal.html("");
    cont = 0;
    for (var j in players) {
      cont++;
      var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
      item.html(players[j].username);
      item.data("player-id", j);
      playersListModal.append(item);
      item.on("click", function() {
        $(this).toggleClass("active");
      });
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

    for (var j in servers) {
      item = $("<button type=\"button\" class=\"list-group-item\"></button>");
      item.html(servers[j].eventserverid);
      item.data("server-id", j);
      serversListModal.append(item);
      item.on("click", function() {
        serversListModal.children().removeClass("active");
        $(this).addClass("active");
      });
    }

    eventModal.modal('show');
  });

  var updateTables = function() {
    playersList.html("");
    teamsList.html("");
    eventsList.html("");

    for (var i in players) {
      /*var item = $("<a class=\"list-group-item clearfix\"><h5 class=\"list-group-item-heading\">" + players[i].username +
                  "</h5><i class=\"list-group-item-text\">" + (teams[players[i].team] !== undefined ? teams[players[i].team].name : "no team") +
                  "</i><span class=\"pull-right\"><button id=\"remove-btn\" class=\"btn btn-xs\"><span class=\"glyphicon glyphicon-remove\"></span></button></span></a>");*/

      var item = $("<a class=\"list-group-item\"><div class=\"container-fluid\" style=\"padding-left: 0;\"><div class=\"row\"><div id=\"button\" style=\"cursor: text;\" class=\"col-xs-10\"><h5 id=\"text\" class=\"list-group-item-heading\"></h5><i id=\"description\" class=\"list-group-item-text\"></i></div><span class=\"pull-right\"><button id=\"remove-button\" class=\"btn btn-xs\"><span class=\"glyphicon glyphicon-remove\"></span></button></span></div></div></a>");
      item.find("#text").html(players[i].username);
      item.find("#description").html((teams[players[i].team] !== undefined ? teams[players[i].team].name : "no team"));

      playersList.append(item);

      var removeBtn = item.find("#remove-button");
      removeBtn.data("id", i);
      removeBtn.on("click", function() {
        var btn = $(this);
        socket.emit("deleteobject", {"id" : btn.data("id"), "type" : "player"});
      });

      item.find("#button").data("id", i);
      item.find("#button").on("click", function() {
        var btn = $(this);
        var teamsListModal = playerModal.find("#create-player-modal-teams-list");
        var id = btn.data("id");

        console.log("edit player: "+id+" "+players[id].username);

        playerModal.find("#username").val(players[id].username);
        playerModal.find("#player-image-form")[0].reset();

        if (players[id].image !== undefined) {
          playerModal.find("#player-image").attr("src", "img/uploads/"+players[id].image);
        } else {
          playerModal.find("#player-image").attr("src", "img/uploads/default");
        }

        var nicknames = "";
        for (var k = 0; k < players[id].nicknames.length; k++) {
          if (k === players[id].nicknames.length - 1) {
            nicknames += players[id].nicknames[k];
          } else {
            nicknames += players[id].nicknames[k] + "\n";
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
          console.log("save player: "+id+" "+players[id].username+" as "+username+", new team "+teamid);
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

        teamsListModal.html("");
        var item = $("<button type=\"button\" class=\"list-group-item\">No team</button>");
        teamsListModal.append(item);
        item.addClass("active");
        item.data("team-id", 0);
        item.on("click", function() {
          teamsListModal.children().removeClass("active");
          $(this).addClass("active");
        });

        for (var j in teams) {
          var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
          item.html(teams[j].name);
          var badge = $("<span class=\"badge\">Color</span>");
          badge.css("background-color", teams[j].color);
          item.append(badge);
          item.data("team-id", j);
          teamsListModal.append(item);
          item.on("click", function() {
            teamsListModal.children().removeClass("active");
            $(this).addClass("active");
          });
          if (players[id].team === j) {
            teamsListModal.children().removeClass("active");
            item.addClass("active");
          }
        }

        playerModal.modal('show');
      });
    }

    for (var i in teams) {
      /*var item = $("<a class=\"list-group-item clearfix\"><h5 class=\"list-group-item-heading\">" + teams[i].name +
                  "</h5><i class=\"list-group-item-text\">" + (teams[i].players.length + " players") +
                  "</i><span class=\"pull-right\"><button id=\"remove-btn\" class=\"btn btn-xs\"><span class=\"glyphicon glyphicon-remove\"></span></button></span></a>");*/

      var item = $("<a class=\"list-group-item\"><div class=\"container-fluid\" style=\"padding-left: 0;\"><div class=\"row\"><div id=\"button\" style=\"cursor: text;\" class=\"col-xs-10\"><h5 id=\"text\" class=\"list-group-item-heading\"></h5><i id=\"description\" class=\"list-group-item-text\"></i></div><span class=\"pull-right\"><button id=\"remove-button\" class=\"btn btn-xs\"><span class=\"glyphicon glyphicon-remove\"></span></button></span></div></div></a>");
      item.find("#text").html(teams[i].name);
      item.find("#description").html((teams[i].players.length === 1 ? teams[i].players.length + " player" : teams[i].players.length + " players"));
      teamsList.append(item);

      var removeBtn = item.find("#remove-button");
      removeBtn.data("id", i);
      removeBtn.on("click", function() {
        var btn = $(this);
        socket.emit("deleteobject", {"id" : btn.data("id"), "type" : "team"});
        item.off("click");
      });

      item.find("#button").data("id", i);
      item.find("#button").on("click", function() {
        console.log("edit team");

        var btn = $(this);
        //var teamsListModal = playerModal.find("#create-player-modal-teams-list");
        var id = btn.data("id");

        teamModal.find("#teamname").val(teams[id].name);
        teamModal.find("#teamcolor").val(teams[id].color);

        teamModal.find("#save-team").off("click");
        teamModal.find("#save-team").on("click", function() {
          teamModal.modal('hide');
          var teamname = teamModal.find("#teamname").val();
          var teamcolor = teamModal.find("#teamcolor").val();

          console.log("create team: "+teamname+", color "+teamcolor);

          socket.emit("updateobject", {"type" : "team", "id" : id, "name" : teamname, "color" : teamcolor});

          teamModal.find("#teamname").val("");
          teamModal.find("#teamcolor").val("#ffffff");
        });

        teamModal.modal('show');
      });
    }

    for (var i in events) {
      /*var item = $("<a class=\"list-group-item clearfix\"><h5 class=\"list-group-item-heading\">" + events[i].name +
                  "</h5><i class=\"list-group-item-text\">" + (events[i].partecipants.length || " partecipants") +
                  "</i><span class=\"pull-right\"><button id=\"remove-btn\" class=\"btn btn-xs\"><span class=\"glyphicon glyphicon-remove\"></span></button></span></a>");*/

      var item = $("<a class=\"list-group-item\"><div class=\"container-fluid\" style=\"padding-left: 0;\"><div class=\"row\"><div id=\"button\" style=\"cursor: text;\" class=\"col-xs-10\"><h5 id=\"text\" class=\"list-group-item-heading\"></h5><i id=\"description\" class=\"list-group-item-text\"></i></div><span class=\"pull-right\"><button id=\"remove-button\" class=\"btn btn-xs\"><span class=\"glyphicon glyphicon-remove\"></span></button></span></div></div></a>");
      item.find("#text").html(events[i].name);
      item.find("#description").html((events[i].partecipants.length === 1 ? events[i].partecipants.length + " partecipant" : events[i].partecipants.length + " partecipants"));
      eventsList.append(item);

      var removeBtn = item.find("#remove-button");
      removeBtn.data("id", i);
      removeBtn.on("click", function() {
        var btn = $(this);
        socket.emit("deleteobject", {"id" : btn.data("id"), "type" : "event"});
        item.off("click");
      });

      item.find("#button").data("id", i);
      item.find("#button").on("click", function() {
        console.log("edit event");

        var btn = $(this);
        var id = btn.data("id");

        var teamsListModal = eventModal.find("#create-event-modal-teams-list");
        var playersListModal = eventModal.find("#create-event-modal-players-list");
        var serversListModal = eventModal.find("#create-event-modal-servers-list");
        eventModal.find("#eventname").val(events[id].name);
        eventModal.find("#rankings").show();
        eventModal.find("#show-rankings").attr("href", "/"+id);

        eventModal.find("#save-event").off("click");
        eventModal.find("#save-event").on("click", function() {
          eventModal.modal('hide');
          var eventname = eventModal.find("#eventname").val();
          var eventserverid = serversListModal.children(".active").data("server-id");
          var teamsSelected = teamsListModal.find(".active");
          var playersSelected = playersListModal.find(".active");

          var partecipants = [];
          teamsSelected.each(function() {
            partecipants.push($(this).data("team-id"));
          });
          playersSelected.each(function() {
            partecipants.push($(this).data("player-id"));
          });

          console.log("create event: "+eventname);

          socket.emit("updateobject", {"type" : "event", "id" : id, "name" : eventname, "partecipants" : partecipants, "eventserverid" : eventserverid});
        });

        var tempids = {};
        for (var n in events[id].partecipants) {
          tempids[events[id].partecipants[n]] = events[id].partecipants[n];
        }
        // Show teams
        var cont = 0;
        teamsListModal.html("");
        for (var j in teams) {
          cont++;
          var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
          item.html(teams[j].name);
          var badge = $("<span class=\"badge\">Color</span>");
          badge.css("background-color", teams[j].color);
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
        for (var j in players) {
          cont++;
          var item = $("<button type=\"button\" class=\"list-group-item\"></button>");
          item.html(players[j].username);
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

        for (var j in servers) {
          item = $("<button type=\"button\" class=\"list-group-item\"></button>");
          item.html(servers[j].eventserverid);
          item.data("server-id", j);
          serversListModal.append(item);
          item.on("click", function() {
            serversListModal.children().removeClass("active");
            $(this).addClass("active");
          });
          if (events[id].eventserverid === j) {
            serversListModal.children().removeClass("active");
            item.addClass("active");
          }
        }

        eventModal.modal('show');
      });
    }
  }

  socket.on("data", function(data) {
    console.log(data);
    players = data.players;
    teams = data.teams;
    events = data.events;
    servers = data.eventservers;
    updateTables();
	});
});
