/**
 * Each section of the site has its own module. It probably also has
 * submodules, though this boilerplate is too simple to demonstrate it. Within
 * `src/app/home`, however, could exist several additional folders representing
 * additional modules that would then be listed as dependencies of this one.
 * For example, a `note` section could have the submodules `note.create`,
 * `note.delete`, `note.edit`, etc.
 *
 * Regardless, so long as dependencies are managed correctly, the build process
 * will automatically take take of the rest.
 *
 * The dependencies block here is also where component dependencies should be
 * specified, as shown below.
 */
angular.module( 'App.view', [
  'ui.router'
])

/**
 * Each section or module of the site can also have its own routes. AngularJS
 * will handle ensuring they are all available at run-time, but splitting it
 * this way makes each module more "self-contained".
 */
.config(function ViewConfig( $stateProvider ) {
  $stateProvider.state( 'view', {
    url: '/view/{path:.*}',
    views: {
      "main": {
        controller: 'ViewCtrl',
        templateUrl: 'view/view.tpl.html'
      }
    },
    data:{ pageTitle: 'View' }
  });
})

/**
 * And of course we define a controller for our route.
 */
.controller( 'ViewCtrl', function ViewController( $scope, $http, $location, $sce, $stateParams ) {
  $scope.hideMenu = function() {
    $scope.$parent.showMenu = false;
  };

  $scope.dirPath = [];

  // TODO: check for (saved) schema
  $scope.path = 'https://'+$stateParams.path;
  console.log("Requested: "+$scope.path); // debug

  var elms = $stateParams.path.split("/");
  var path = '';
  for (i=0; i<elms.length; i++) {
    path = (i===0)?elms[0]+'/':path+elms[i]+'/';
    var dir = {
      uri: path,
      name: elms[i]
    };

    $scope.dirPath.push(dir);
  }

 });
