angular.module("entropicsFest", [])

	.value('config', {
		'OFFSET_Y': 50
	})

	.factory('socket', function ($rootScope) {
	  var socket = io.connect("0.0.0.0:3000");
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

			socket.emit("create", $("#eventId").text());
			socket.on("getRanking", function(data){
				console.log(data);
				data.forEach(function(x){
					x.points = (x.kills*10)+(x.headshots*5)+(x.knives*4);
					//$scope.users[x.id] = x;
				});
				$scope.users = data;
				$scope.users.sort(updatePositions);
				for(var x in $scope.users) {
					$scope.users[x].position = x;
					$scope.users[x].position++;
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
						setTimeout(function() {
							var a = [u, data.players[x]];
							u.kills = _.sum(a, "kills");
							u.headshots = _.sum(a, "headshots");
							u.knives = _.sum(a, "knives");
							u.kamikaze = _.sum(a, "kamikaze");
							u.deaths = _.sum(a, "deaths");
							u.points = (u.kills*10)+(u.headshots*5)+(u.knives*4);
						}, 10);
						
					} else {
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

			function updatePositions(a, b) {
				if (a.points < b.points)
					return 1;
				if (a.points > b.points)
					return -1;
				return 0;
			}

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
						var i = $scope.find($el.find("#id").text());
						$scope.users[i].position = el.rowIndex;
						
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