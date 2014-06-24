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
  'ui.router',
  'ngProgress'
])

.config( function AppConfig ( $stateProvider, $urlRouterProvider ) {
  $urlRouterProvider.otherwise( '/login' );
})

.run( function run () {
})

.controller( 'MainCtrl', function MainCtrl ( $scope, $location, $timeout, ngProgress ) {
  // Some default values
  $scope.appuri = window.location.hostname+window.location.pathname;
  $scope.loginSuccess = false;
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


  // cache user credentials in sessionStorage to avoid double sign in
  $scope.saveCredentials = function () {
    var app = {};
    var _user = {};
    app.userProfile = $scope.userProfile;
    sessionStorage.setItem($scope.appuri, JSON.stringify(app));
  };

  // retrieve from sessionStorage
  $scope.loadCredentials = function () {
    if (sessionStorage.getItem($scope.appuri)) {
      var app = JSON.parse(sessionStorage.getItem($scope.appuri));
      if (app.userProfile) {
        if (!$scope.userProfile) {
          $scope.userProfile = {};
        }
        $scope.userProfile = app.userProfile;
        $scope.loggedin = true;
        if ($scope.userProfile.channels) {
          $scope.defaultChannel = $scope.userProfile.channels[0];
        }
        // load from PDS (follows)
        if ($scope.userProfile.mbspace && (!$scope.users || $scope.users.length === 0)) {
          $scope.getUsers();
        }
        // refresh data
        $scope.getInfo(app.userProfile.webid, true);
      } else {
        // clear sessionStorage in case there was a change to the data structure
        sessionStorage.removeItem($scope.appuri);
      }
    }
  };

  // clear sessionStorage
  $scope.clearLocalCredentials = function () {
    sessionStorage.removeItem($scope.appuri);
  };

  $scope.$watch('loginSuccess', function(newVal, oldVal) {
    if (newVal === true && $scope.userProfile.webid) {
      $scope.getInfo($scope.userProfile.webid, true, false);
    }
  });

  // get relevant info for a webid
  $scope.getInfo = function(webid, mine, update) {
    if (DEBUG) {
      console.log("Getting user info for: "+webid);
    }
    // start progress bar
    ngProgress.start();

    if (mine) {
      $scope.loading = true;
    }

    $scope.found = true;

    var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
    var SPACE = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
    var ACL = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");
    var g = $rdf.graph();
    var f = $rdf.fetcher(g, TIMEOUT);
    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate=PROXY;

    var docURI = webid.slice(0, webid.indexOf('#'));
    var webidRes = $rdf.sym(webid);

    // fetch user data
    f.nowOrWhenFetched(docURI,undefined,function(ok, body) {
      if (!ok) {
        if ($scope.search && $scope.search.webid && $scope.search.webid == webid) {
          notify('Warning', 'WebID profile not found.');
          $scope.found = false;
          $scope.searchbtn = 'Search';
          // reset progress bar
          ngProgress.reset();
          $scope.$apply();
        }
      }
      // get some basic info
      var name = g.any(webidRes, FOAF('name'));
      // Clean up name
      name = (name)?name.value:'';
      var pic = g.any(webidRes, FOAF('img'));
      var depic = g.any(webidRes, FOAF('depiction'));
      // set avatar picture
      if (pic) {
        pic = pic.value;
      } else {
        if (depic) {
          pic = depic.value;
        } else {
          pic = 'assets/generic_photo.png';
        }
      }
      // get storage endpoints
      var storage = g.any(webidRes, SPACE('storage'));
      if (storage !== undefined) {
        storage = storage.value;
      } else {
        $scope.gotstorage = false;
      }
      /*
      if (delegs.length > 0) {
        jQuery.ajaxPrefilter(function(options) {
          options.url = AUTH_PROXY + encodeURIComponent(options.url);
        });
      }
      */

      $scope.userProfile.name = name;
      $scope.userProfile.picture = pic;
      $scope.userProfile.storagespace = storage;

      // find microblogging feeds/channels
      if (!storage) {
        $scope.loading = false; // hide spinner
      }

      // cache user credentials in sessionStorage
      $scope.saveCredentials();

      // update DOM
      $scope.loggedin = true;
      $scope.profileloading = false;
      ngProgress.complete();
      $scope.$apply();
    });
  };

  $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){
    if ( angular.isDefined( toState.data.pageTitle ) ) {
      $scope.pageTitle = toState.data.pageTitle + ' | App Name' ;
    }
  });

  // initialize by retrieving user info from sessionStorage
  $scope.loadCredentials();
});
