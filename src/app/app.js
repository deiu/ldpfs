// Globals
var PROXY = "https://rww.io/proxy?uri={uri}";
var AUTH_PROXY = "https://rww.io/auth-proxy?uri=";
var TIMEOUT = 90000;
var DEBUG = true;

// Angular
angular.module( 'App', [
  'templates-app',
  'templates-common',
  'App.home',
  'App.login',
  'App.about',
  'ui.router'
])

.config( function AppConfig ( $stateProvider, $urlRouterProvider ) {
  $urlRouterProvider.otherwise( '/login' );
})

.run( function run () {
})

.controller( 'MainCtrl', function MainCtrl ( $scope, $location, $timeout, ngProgress ) {
  // Some default values
  $scope.appuri = window.location.hostname+window.location.pathname;
  $scope.userProfile = {};
  $scope.userProfile.picture = 'assets/generic_photo.png';

  $scope.login = function () {
    $location.path('/login');
  };

  $scope.logout = function () {
    // Logout WebID (only works in Firefox and IE)
    if (document.all == null) {
      if (window.crypto) {
          try{
              window.crypto.logout(); //firefox ok -- no need to follow the link
          } catch (err) {//Safari, Opera, Chrome -- try with tis session breaking
          }
      }
    } else { // MSIE 6+
      document.execCommand('ClearAuthenticationCache');
    }

    // clear sessionStorage
    $scope.clearLocalCredentials();
    $scope.userProfile = {};
    $location.path('/login');
  };

  // clear sessionStorage
  $scope.clearLocalCredentials = function () {
    sessionStorage.removeItem($scope.appuri);
  };

  $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){
    if ( angular.isDefined( toState.data.pageTitle ) ) {
      $scope.pageTitle = toState.data.pageTitle + ' | App Name' ;
    }
  });

  // initialize by retrieving user info from sessionStorage
  // retrieve from sessionStorage
  if (sessionStorage.getItem($scope.appuri)) {
      var app = JSON.parse(sessionStorage.getItem($scope.appuri));
      if (app.userProfile) {
        if (!$scope.userProfile) {
          $scope.userProfile = {};
        }
        $scope.userProfile = app.userProfile;
        $scope.loggedin = true;
      } else {
        // clear sessionStorage in case there was a change to the data structure
        sessionStorage.removeItem($scope.appuri);
      }
    }
});
