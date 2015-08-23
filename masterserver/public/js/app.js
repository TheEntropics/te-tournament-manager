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
			$scope.eventid = $("#eventId").text();

			socket.on("connect", function() {
				if ($scope.eventid === "rankings") $scope.end = true;
				socket.emit("joinevent", $("#eventId").text());
			});

			socket.on("roundstarted", function() {
				if ($scope.eventid === "rankings") return;
				$scope.end = false;
			});

			socket.on("roundended", function() {
				if ($scope.eventid === "rankings") return;
				$scope.end = true;
			});

			socket.on("updateplayers", function(players) {
				//if ($scope.eventid !== "rankings") $scope.end = false;
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
				var points = (data.kills*10)+(data.headshots*5)+(data.knives*4)+(data.kamikaze*5);
				var killsdeathsratio = data.deaths !== 0 ? data.kills / data.deaths : 0;
				points -= Math.floor(killsdeathsratio * 5);

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
						player.data.killstreak = data.players[playerid].killstreak > player.data.killstreak ? data.players[playerid].killstreak : player.data.killstreak;
						player.points = calculatePoints(player.data);
						$window.clearTimeout($scope.timer);
						$scope.timer = $window.setTimeout(rearrange, 100);
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
			$scope.toggleDetails = function() {
				$scope.end = !$scope.end;
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
				var imfirst = true;
				$('.item').each(function(idx, el){
					var $el = $(el);
					var newTop = idx * $config.OFFSET_Y;
					if (newTop != parseInt($el.css('top'))) {
						$el.css({
							'top': newTop
						})
						if (imfirst) {
							if ($el.hasClass('movingdown')) $el.removeClass('movingdown');
							$el.one('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function (evt){
								$(evt.target).removeClass('movingup');
							})
							.addClass('movingup');
							imfirst = false;
						} /*else {
							if (!$el.hasClass('movingup')) {
								$el.one('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function (evt){
									$(evt.target).removeClass('movingdown');
								})
								.addClass('movingdown');
							}
						}*/
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
					else if (nv===false) return;
	        else element.addClass('pulse');
	        $timeout(function() {
	          if(nv===true) element.removeClass('slideInLeft');
						else if (nv===false) return;
	          else element.removeClass('pulse');
	        }, 1000); // Could be enhanced to take duration as a parameter
	      }
	    });
	  };
	});
