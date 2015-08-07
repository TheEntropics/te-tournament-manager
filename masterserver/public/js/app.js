angular.module("entropicsFest", [])

	.value('config', {
		'OFFSET_Y': 50
	})

	.factory('socket', function ($rootScope) {
	  var socket = io.connect("http://localhost:3000/");
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
		'config',
		'$window',
		'$timeout',
		'socket',

		function ($scope, $root, $config, $window, $timeout, socket) {
			$scope.sorter = 'points';

			$scope.users = [];

			socket.on("connect", function() {
				socket.emit("joinevent", $("#eventId").text());
			});

			/*socket.on("rankings", function(rankings){
				$scope.users = [];
				for (var i in rankings) {
					var player = rankings[i];
					if (player.data !== undefined) {
						player.points = calculatePoints(player.data);
					}
					$scope.users.push(player);
				}
				console.log($scope.users);
			});*/

			/*socket.on("addplayer", function(player){
				if (find(player.id) === null) {
					console.log("Adding user: " + player.id + " " + player.username);
					player.points = calculatePoints(player.data);
					$scope.users.push(player);
				}
			});

			socket.on("removeplayer", function(data){
				console.log("Removing user: " + data.id);
				var player = find(data.id);
				if (player !== null) {
					console.log("user removed.");
					var index = $scope.users.indexOf(player);
					$scope.users.splice(index, 1);
				}
			});*/

			socket.on("updateplayers", function(players) {
				var playerstoremove = {};
				for (var i in $scope.users) {
					playerstoremove[$scope.users[i].id] = $scope.users[i].id;
				}

				for (var playerid in players) {
					var player = find(playerid);
					if (player === null) {
						// Adding new players
						players[playerid].points = calculatePoints(players[playerid].data);
						$scope.users.push(players[playerid]);
					} else {
						// Keeping the existing ones
						player.username = players[playerid].username;
						player.image = players[playerid].image;
						playerstoremove[playerid] = undefined;
					}
				}

				// Removing players
				for (var i in playerstoremove) {
					if (playerstoremove[i] === undefined) continue;
					var player = find(i);
					if (player !== null) {
						var index = $scope.users.indexOf(player);
						$scope.users.splice(index, 1);
					}
				}
			});

			function calculatePoints(data) {
				var points = (data.kills*10)+(data.headshots*5)+(data.knives*4);
				return points;
			}

			function find(id) {
				for(var i in $scope.users){
					var x = $scope.users[i];
					if(x.id == id) return x;
				};
				return null;
			}

			socket.on("updateranking", function(data){
				console.log("updateranking");
				for (var playerid in data.players) {
					var player = find(playerid);
					if(player !== null) {
						var a = [player.data, data.players[playerid]];
						player.data.kills = _.sum(a, "kills");
						player.data.headshots = _.sum(a, "headshots");
						player.data.knives = _.sum(a, "knives");
						player.data.kamikaze = _.sum(a, "kamikaze");
						player.data.deaths = _.sum(a, "deaths");
						player.points = calculatePoints(player.data);
					}
				}
			});

			$scope.getUsers = function() {
				for(var x=0; x<15; x++) {
					$scope.users.push({
						id: x,
						position: x,
						nickname: "-\\-"+x+"-/-",
						headshot: Math.floor((Math.random() * 10) + 1),
					    knives: Math.floor((Math.random() * 10) + 1),
					    kamikaze: Math.floor((Math.random() * 10) + 1),
					    kills: Math.floor((Math.random() * 50) + 1),
					    deaths: Math.floor((Math.random() * 60) + 1),
					    points: Math.floor((Math.random() * 10000) + 1)
					});
				}

				$scope.users.sort(updatePositions);
				for(var x in $scope.users) {
					$scope.users[x].position = x;
					$scope.users[x].position++;
				}
			};
			$scope.getN = function(){
				var i = [];
				var cont = 0;
				for(var x in $scope.users){i.push(++cont);}
				return i;
			};

			$scope.timer = 0;

			$root.currItemIndex = 0;
			$scope.x = function() {
				var y = Math.floor((Math.random() * 8) + 1);
				$scope.users[y].points += 1000;
				$window.clearTimeout($scope.timer);
				$scope.timer = $window.setTimeout(rearrange, 100);
			};
			$scope.endG = function() {
				$scope.end = true;
			};
			$scope.start = function() {
				$scope.end = false;
			};
			$scope.find = function(id){
				var i = 0;
				for(var x in $scope.users) {
					if($scope.users[x].id == id) return i;
					i++;
				}
				return null;
			}
			function rearrange(){
				$('.item').each(function(idx, el){
					var $el = $(el);
					var newTop = idx * $config.OFFSET_Y;
					if (newTop != parseInt($el.css('top'))) {
						$el.css({
							'top': newTop
						})
						.one('webkitTransitionEnd', function (evt){
							$(evt.target).removeClass('moving');
						})
						.addClass('moving');
					}

				});
			}

		}
	])

	.controller('jdController', [
		'$element',
		'$rootScope',
		'config',

		function($el, $root, $config){
			$el.css({
				'top': $root.currItemIndex * $config.OFFSET_Y
			});
			$root.currItemIndex++;
		}
	])

	.directive('jdScript', [
		function(){
			return {
				restrict: 'EA',
				controller: 'jdController'
			};
		}
	])

	.directive('animateOnChange', function($timeout) {
	  return function(scope, element, attr) {
	    scope.$watch(attr.animateOnChange, function(nv,ov) {
	      if (nv!=ov) {
	        if(nv===true) element.addClass('slideInLeft');
	        else element.addClass('pulse');
	        $timeout(function() {
	          if(nv===true) element.removeClass('slideInLeft');
	          else element.removeClass('pulse');
	        }, 1000); // Could be enhanced to take duration as a parameter
	      }
	    });
	  };
	});
