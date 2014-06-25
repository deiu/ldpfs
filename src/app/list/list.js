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

dirname = function(path) {
    return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
};

basename = function(path) {
    if (path.substring(path.length - 1) == '/') {
      path = path.substring(0, path.length - 1);
    }

    var a = path.split('/');
    return a[a.length - 1];
};

angular.module( 'App.list', [
  'ui.router',
  'ngProgress'
])


/**
 * Filters
 */
.filter('fromNow', function() {
  return function(date) {
    return moment(date*1000).format('YYYY-MM-DD, h:mm:ss a');
  };
})

/**
 * Each section or module of the site can also have its own routes. AngularJS
 * will handle ensuring they are all available at run-time, but splitting it
 * this way makes each module more "self-contained".
 */
.config(function ViewConfig( $stateProvider ) {
  $stateProvider.state( 'list', {
    url: '/list/{path:.*}',
    views: {
      "main": {
        controller: 'ListCtrl',
        templateUrl: 'list/list.tpl.html'
      }
    },
    data:{ pageTitle: 'Listing contents' }
  });
})

/**
 * And of course we define a controller for our route.
 */
.controller( 'ListCtrl', function ListController( $scope, $http, $location, $sce, $stateParams, ngProgress ) {
  $scope.hideMenu = function() {
    $scope.$parent.showMenu = false;
  };

  // variables
  var storage = $scope.$parent.userProfile.storagespace;
  var schema = (storage !== undefined)?storage.slice(0, storage.indexOf('://')):$location.$$protocol;
  $scope.resources = [];
  $scope.dirPath = [];

  // TODO: check for (saved) schema
  $scope.path = schema+'://'+$stateParams.path;
  console.log("Requested: "+$scope.path); // debug

  var elms = $stateParams.path.split("/");
  var path = '';
  for (i=0; i<elms.length; i++) {
    if (elms[i].length > 0) {
      path = (i===0)?elms[0]+'/':path+elms[i]+'/';
      var dir = {
        uri: '#/list/'+path,
        name: elms[i]
      };

      $scope.dirPath.push(dir);
    }
  }

  $scope.listDir = function (url) {
    // start progress bar
    ngProgress.start();

    var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    var RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
    var LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
    var POSIX = $rdf.Namespace("http://www.w3.org/ns/posix/stat#");

    var g = $rdf.graph();
    var f = $rdf.fetcher(g, TIMEOUT);
    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate=PROXY;

    // fetch user data
    f.nowOrWhenFetched(url,undefined,function(ok, body) {
      if (!ok) {
        notify('', 'Could not fetch dir listing.');
        // reset progress bar
        ngProgress.reset();
        $scope.$apply();
      }

      var dirs = g.statementsMatching(undefined, RDF("type"), POSIX("Directory"));
      for (var i in dirs) {
        var d = {};
        var isRoot = (url.split('://')[1].split('/').length <= 2)?true:false;
        if (dirs[i].subject.uri == url) {
          d = {
            uri: (isRoot)?document.location.href:dirname(document.location.href)+'/',
            type: 'Directory',
            name: (isRoot)?'/':'../',
            mtime: g.any(dirs[i].subject, POSIX("mtime")).value,
            size: '-'
          };
        } else {
          d = {
            uri: document.location.href+basename(dirs[i].subject.uri)+'/',
            type: 'Directory',
            name: basename(dirs[i].subject.value),
            mtime: g.any(dirs[i].subject, POSIX("mtime")).value,
            size: '-'
          };
        }
        $scope.resources.push(d);
      }
      var files = g.statementsMatching(undefined, RDF("type"), RDFS("Resource"));
      for (i in files) {
        var f = {
          uri: document.location.href+basename(files[i].subject.uri),
          type: 'File', // TODO: use the real type
          name: basename(files[i].subject.value),
          mtime: g.any(files[i].subject, POSIX("mtime")).value,
          size: g.any(files[i].subject, POSIX("size")).value
        };
        $scope.resources.push(f);
      }
      console.log($scope.resources);

      ngProgress.complete();
      $scope.$apply();
    });
  };

  $scope.listDir($scope.path);

 });
