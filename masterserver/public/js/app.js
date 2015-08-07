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
			$scope.players = {};

			socket.on("connect", function() {
				socket.emit("create", $("#eventId").text());
			});

			/*socket.on("playerslist", function(players){
				console.log(players);
				$scope.players = players;
			});*/
			socket.on("rankings", function(rankings){
				$scope.users = [];
				for (var i in rankings) {
					var player = rankings[i];
					if (player.data !== undefined) {
						player.points = (player.data.kills*10)+(player.data.headshots*5)+(player.data.knives*4);
					}
					$scope.users.push(player);
				}
				console.log($scope.users);
			});

			socket.on("addUser", function(data){
				//console.log(data);
				console.log(data.id, data.nickname);
				if(find(data.id) === null) {
					$scope.users.push({
						id: data.id,
						nickname: data.nickname,
						image: data.image,
						kills: 0,
						headshots: 0,
						knives: 0,
						kamikaze: 0,
						deaths: 0,
						points: 0
					});
				}
			});
			function find(id) {
				for(var i in $scope.users){
					var x = $scope.users[i];
					if(x.id == id) return x;
				};
				return null;
			}
			socket.on("updateRanking", function(data){
				console.log("updateRanking");
				for(var x in data.players) {
					var u = find(x);
					if(u!==null) {
						var a = [u, data.players[x]];
						u.kills = _.sum(a, "kills");
						u.headshots = _.sum(a, "headshots");
						u.knives = _.sum(a, "knives");
						u.kamikaze = _.sum(a, "kamikaze");
						u.deaths = _.sum(a, "deaths");
						u.points = (u.kills*10)+(u.headshots*5)+(u.knives*4);
						console.log(u, a[0]);
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
