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

angular.module( 'App.list', [
  'ui.router',  
  'ngProgress',
  'ngAnimate',
  'ui.bootstrap',
  'ui.bootstrap.tpls',
  'angularFileUpload'
])

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
    data:{ pageTitle: 'Listing resources' }
  });
})

/**
 * Filters
 */
.filter('classicDate', function() {
  return function(date) {
    date = (date<10000000000)?date*1000:date;
    return moment(date).format('YYYY-MM-DD, h:mm:ss a');
  };
})

.filter('fromNow', function() {
  return function(date) {
    date = (date<10000000000)?date*1000:date;
    return moment(date).fromNow();
  };
})


.filter('fileSize', function() {
  return function(bytes) {
    return humanFileSize(bytes);
  };
})

.filter('truncate', function() {
  return function(string, size) {
    if (string.length > size) {
      return string.substring(0, size)+'...';
    } else {
      return string;
    }
  };
})

/**
 * Directives
 */
.directive('ngFocus', function($timeout) {
    return {
        link: function ( scope, element, attrs ) {
            scope.$watch( attrs.ngFocus, function ( val ) {
                if ( angular.isDefined( val ) && val ) {
                    $timeout( function () { element[0].focus(); } );
                }
            }, true);

            element.bind('blur', function () {
                if ( angular.isDefined( attrs.ngFocusLost ) ) {
                    scope.$apply( attrs.ngFocusLost );

                }
            });
        }
    };
})

/**
 * And of course we define a controller for our route.
 */
.controller( 'ListCtrl', function ListController( $scope, $http, $location, $modal, $sce, $stateParams, ngProgress ) {
  $scope.hideMenu = function() {
    $scope.$parent.showMenu = false;
  };

  // variables
  $scope.schema = '';
  $scope.resources = [];
  $scope.listLocation = true;
  $scope.emptyDir = false;
  $scope.breadCrumbs = [];

  $scope.prepareList = function(url) {
    if (url && url.length > 0) {
      $scope.listLocation = true;
      $location.path('/list/'+stripSchema(url));
    } else {
      $scope.listLocation = false;
      notify('Warning', 'Please provide a URL');
    }
  };

  // TODO: rdflib fetch does not respond properly to 404
  $scope.listDir = function (url) {
    var elms = url.split("/");
    var schema = '';
    var path = '';
    if (elms[0].substring(0, 4) == 'http') {
      schema = elms[0];
      elms.splice(0,1);
    } else {
      schema = 'https';
    }
    $scope.path = schema+'://';

    for (i=0; i<elms.length; i++) {
      if (elms[i].length > 0) {
        path = (i===0)?elms[0]+'/':path+elms[i]+'/';
        var dir = {
          uri: '#/list/'+schema+'/'+path,
          name: decodeURIComponent(elms[i])
        };

        $scope.breadCrumbs.push(dir);
      }
    }
    $scope.path += path;

    // start progress bar
    ngProgress.complete();
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
    f.nowOrWhenFetched($scope.path,undefined,function(ok, body) {
      if (!ok) {
        notify('Error', 'Could not fetch dir listing. Is the server available?');
        ngProgress.complete();
        $scope.listLocation = false;

        console.log(ok);
        console.log(body);
      } else {
        $scope.listLocation = true;
      }
      $scope.$apply();

      var dirs = g.statementsMatching(undefined, RDF("type"), POSIX("Directory"));
      for ( var i in dirs ) {
        if ( dirs[i].subject.uri.split('://')[1].split('/').length <= 2 ) {
          continue;
        }
        var d = {};
        if ( dirs[i].subject.uri == $scope.path ) {
          d = {
            id: $scope.resources.length+1,
            uri: dirs[i].subject.uri,
            path: dirname(document.location.href)+'/',
            type: '-',
            name: '../',
            mtime: g.any(dirs[i].subject, POSIX("mtime")).value,
            size: '-'
          };
        } else {
          var base = (document.location.href.charAt(document.location.href.length - 1) === '/')?document.location.href:document.location.href+'/';
          d = {
            id: $scope.resources.length+1,
            uri: dirs[i].subject.uri,
            path: base+encodeURIComponent(basename(dirs[i].subject.uri))+'/',
            type: 'Directory',
            name: decodeURIComponent(basename(dirs[i].subject.value).replace("+", "%20")),
            mtime: g.any(dirs[i].subject, POSIX("mtime")).value,
            size: '-'
          };
        }
        $scope.resources.push(d);
      }
      // either POSIX:File or RDFS:Resource
      // TODO: remove duplicates using something like http://lodash.com/docs#union
      var files = g.statementsMatching(undefined, RDF("type"), POSIX("File"));
      files = (files.length > 0)?files.concat(g.statementsMatching(undefined, RDF("type"), RDFS("Resource"))):g.statementsMatching(undefined, RDF("type"), RDFS("Resource"));
      for (i in files) {
        var f = {
          id: $scope.resources.length+1,
          uri: files[i].subject.uri,
          path: files[i].subject.uri,
          type: 'File', // TODO: use the real type
          name: decodeURIComponent(basename(files[i].subject.value).replace("+", "%20")),
          mtime: g.any(files[i].subject, POSIX("mtime")).value,
          size: g.any(files[i].subject, POSIX("size")).value
        };
        $scope.resources.push(f);
        $scope.$apply();
      }
      if ($scope.resources.length === 0) {
        $scope.emptyDir = true;
      }
      ngProgress.complete();

      $scope.$apply();
    });
  };

  $scope.upload = function () {
    console.log("Uploading files");
  };

  $scope.newDir = function(dirName) {
    // trim whitespaces
    dirName = dirName.replace(/^\s+|\s+$/g, "");
    $http({
      method: 'PUT', 
      url: $scope.path+encodeURIComponent(dirName),
      data: '',
      headers: {
        'Content-Type': 'text/turtle',
        'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' 
      },
      withCredentials: true
    }).
    success(function(data, status) {
      if (status == 200 || status == 201) {
        notify('Success', 'Directory created.');
        // add dir to local list
        var now = new Date().getTime();
        var base = (document.location.href.charAt(document.location.href.length - 1) === '/')?document.location.href:document.location.href+'/';
        addResource($scope.resources, $scope.path+dirName, 'Directory');
        $scope.emptyDir = false;
      }
    }).
    error(function(data, status) {
      if (status == 401) {
        notify('Forbidden', 'Authentication required to create new directory.');
      } else if (status == 403) {
        notify('Forbidden', 'You are not allowed to create new directory.');
      } else {
        notify('Failed '+status, data, 5000);
      }
    });
  };

  $scope.newFile = function(fileName) {
    // trim whitespaces
    fileName = fileName.replace(/^\s+|\s+$/g, "");
    $http({
      method: 'PUT', 
      url: $scope.path+encodeURIComponent(fileName),
      data: '',
      headers: {
        'Content-Type': 'text/turtle',
        'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
      },
      withCredentials: true
    }).
    success(function(data, status, headers) {
      if (status == 200 || status == 201) {
        // Add resource to the list
        addResource($scope.resources, $scope.path+encodeURIComponent(fileName), 'File');
        $scope.emptyDir = false;
        notify('Success', 'Resource created.');
      }
    }).
    error(function(data, status) {
      if (status == 401) {
        notify('Forbidden', 'Authentication required to create new resource.');
      } else if (status == 403) {
        notify('Forbidden', 'You are not allowed to create new resource.');
      } else {
        notify('Failed '+status, data);
      }
    });
  };

  $scope.refreshResource = function(uri) {
    // TODO
  };

  $scope.deleteResource = function(resourceUri) {
    $http({
      method: 'DELETE', 
      url: resourceUri,
      withCredentials: true
    }).
    success(function(data, status, headers) {
      if (status == 200) {
          $scope.removeResource(resourceUri);
//        // remove resource from the view
//        $scope.removeResource(resourceUri);
//        //TODO: remove the acl and meta files.
//        var lh = parseLinkHeader(headers('Link'));
//        console.log(lh);
//        if (lh['acl'] && lh['acl']['href'].length > 0) {
//          $http({
//            method: 'DELETE',
//            url: lh['acl']['href'],
//            withCredentials: true
//          }).
//          success(function (data, status) {
//            $scope.removeResource(lh['acl']['href']);
//          }).
//          error(function(data, status) {
//            if (status == 401) {
//              notify('Forbidden', 'Authentication required to delete the resource.');
//            } else if (status == 403) {
//              notify('Forbidden', 'You are not allowed to delete the resource.');
//            } else {
//              console.log('Failed to delete '+lh['acl']['href']+" Server responded with HTTP "+status);
//            }
//          });
//        }
//        if (lh['meta'] && lh['meta']['href'].length > 0) {
//          $http({
//            method: 'DELETE',
//            url: lh['meta']['href'],
//            withCredentials: true
//          }).
//          success(function (data, status) {
//            $scope.removeResource(lh['meta']['href']);
//          }).
//          error(function(data, status) {
//            if (status == 401) {
//              notify('Forbidden', 'Authentication required to delete the resource.');
//            } else if (status == 403) {
//              notify('Forbidden', 'You are not allowed to delete the resource.');
//            } else {
//              console.log('Failed to delete '+lh['meta']['href']+" Server responded with HTTP "+status);
//            }
//          });
//        }
      }
    }).
    error(function(data, status) {
      if (status == 401) {
        notify('Forbidden', 'Authentication required to delete resource.');
      } else if (status == 403) {
        notify('Forbidden', 'You are not allowed to delete resource.');
      } else if (status == 409) {
        notify('Failed', 'Conflict detected. In case of directory, check if not empty.');
      } else {
        notify('Failed '+status, data);
      }
    });
  };

  $scope.removeResource = function(uri) {
    if ($scope.resources) {
      for(var i = $scope.resources.length - 1; i >= 0; i--){
        if($scope.resources[i].uri == uri) {
          $scope.resources.splice(i,1);
          notify('Success', 'Deleted '+decodeURIComponent(basename(uri)+'.'));
          if ($scope.resources.length === 0) {
            $scope.emptyDir = true;
          }
        }
      }
    }
  };

  // New dir dialog
  $scope.openNewDir = function () {
    var modalInstance = $modal.open({
      templateUrl: 'newdir.html',
      controller: ModalNewDirCtrl,
      size: 'sm'
    });
    modalInstance.result.then($scope.newDir);
  };
  // New file creation dialog
  $scope.openNewFile = function () {
    var modalInstance = $modal.open({
      templateUrl: 'newfile.html',
      controller: ModalNewFileCtrl,
      size: 'sm'
    });
    modalInstance.result.then($scope.newFile);
  };
  // Remove resource dialog
  $scope.openDelete = function (uri) {
    var modalInstance = $modal.open({
      templateUrl: 'delete.html',
      controller: ModalDeleteCtrl,
      size: 'sm',
      resolve: { 
        uri: function () {
          return uri;
        }
      }
    });
    modalInstance.result.then($scope.deleteResource);
  };
  // New file upload dialog
  $scope.openNewUpload = function (url) {
    var modalInstance = $modal.open({
      templateUrl: 'uploadfiles.html',
      controller: ModalUploadCtrl,
      size: 'sm',
      resolve: { 
        url: function () {
          return url;
        },
        resources: function () {
          return $scope.resources;
        }
      }
    });
  };
  // ACL dialog
  $scope.openACLEditor = function (uri) {
    console.log("Opening ACL editor");
    var modalInstance = $modal.open({
      templateUrl: 'acleditor.html',
      controller: ModalACLEditor,
      resolve: { 
        uri: function () {
          return uri;
        }
      }
    });
  };

  // Display list for current path
  if ($stateParams.path.length > 0) {
    $scope.listDir($stateParams.path);
  } else {
    $scope.listLocation = false;
  }
});


var addResource = function (resources, uri, type, size) {
  // Add resource to the list
  console.log("Resource URI: "+uri);
  var base = (document.location.href.charAt(document.location.href.length - 1) === '/')?document.location.href:document.location.href+'/';
  var path = (type === 'File')?dirname(uri)+'/'+encodeURIComponent(basename(uri)):base+basename(uri)+'/';
  var now = new Date().getTime();
  size = (size)?size:'-';
  var f = {
    id: resources.length+1,
    uri: uri,
    path: path,
    type: type, // TODO: use the real type
    name: decodeURIComponent(basename(uri)),
    mtime: now,
    size: size
  };
  // overwrite previous resource
  var found = false;
  if (resources.length > 0) {
    for(var i = resources.length - 1; i >= 0; i--){
      if(decodeURIComponent(resources[i].uri) == decodeURIComponent(uri)) {
        resources[i] = f;
        found = true;
        break;
      }
    }
  }
  if (!found) {
    resources.push(f);
  }
};


// Modal Ctrls
var ModalNewDirCtrl = function ($scope, $modalInstance) {
  $scope.isFocused = true;

  $scope.newDir = function(dirName) {
    $modalInstance.close(dirName);
  };

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};

var ModalNewFileCtrl = function ($scope, $modalInstance) {
  // TODO
  // $scope.expr = "/^[A-Za-z0-9_-(\.)]*$/";

  $scope.isFocused = true;

  $scope.newFile = function(fileName) {
    $modalInstance.close(fileName);
  };

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};

var ModalDeleteCtrl = function ($scope, $modalInstance, uri) {
  $scope.delUri = uri;
  $scope.resource = decodeURIComponent(basename(uri));
  $scope.deleteResource = function() {
    $modalInstance.close($scope.delUri);
  };

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};

var ModalUploadCtrl = function ($scope, $modalInstance, $upload, url, resources) {
  $scope.url = url;
  $scope.resources = resources;
  $scope.container = basename(url);
  $scope.uploading = [];
  $scope.progress = [];
  $scope.filesUploading = 0;

  // stop/abort the upload of a file
  $scope.abort = function(index) {
    console.log($scope.uploading.length);
    $scope.uploading[index].abort();
  };

  // remove file from upload list
  $scope.remove = function(index) {
    if ($scope.selectedFiles.length > 0) {
      for (var i = $scope.selectedFiles.length - 1; i >= 0; i--) {
        if(decodeURIComponent($scope.selectedFiles[i].name) == decodeURIComponent(index)) {
          $scope.selectedFiles.splice(i, 1);
          $scope.uploading[index].abort();
          $scope.uploading[index] = null;
          break;
        }
      }
    }
  };

  $scope.clearUploaded = function () {
    $scope.selectedFiles = [];
  };

  $scope.$watch('filesUploading', function(newVal, oldVal) {
    if (oldVal > 0 && newVal === 0) {
      notify('Success', 'Finished uploading files!');
    }
  });

  // TODO: handle errors during upload
  $scope.doUpload = function(file) {
    $scope.progress[file.name] = 0;
    file.name = file.name.replace(/^\s+|\s+$/g, "");
    $scope.uploading[file.name] = $upload.upload({
        url: $scope.url,
        method: 'POST',
        withCredentials: true,
        file: file
      }).progress(function(evt) {
        var progVal = parseInt(100.0 * evt.loaded / evt.total, 10);
        $scope.progress[file.name] = progVal;
      }).success(function(data, status, headers, config) {
        // file is uploaded successfully
        $scope.filesUploading--;
        addResource($scope.resources, $scope.url+encodeURIComponent(file.name), 'File', file.size);
    });
  };

  $scope.onFileSelect = function($files) {
    $scope.selectedFiles = $files;
    $scope.filesUploading = $files.length;

    for (var i = 0; i < $files.length; i++) {
      var file = $files[i];
      $scope.doUpload(file);
    }
  };

  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};

var ModalACLEditor = function ($scope, $modalInstance, $http, uri) {
  $scope.uri = uri;
  $scope.resource = decodeURIComponent(basename(uri));
  $scope.aclURI = '';
  $scope.owners = [];
  $scope.users = [];
  $scope.groups = [];
  $scope.others = [];
  
  $scope.loading = true;  
  
  // Find ACL uri
  $http({
    method: 'HEAD',
    url: uri,
    withCredentials: true
  }).
  success(function(data, status, headers) {
    // add dir to local list
    var lh = parseLinkHeader(headers('Link'));
    $scope.aclURI = (lh['acl'] && lh['acl']['href'].length > 0)?lh['acl']['href']:'';
  
    // Load ACL triples
    var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    var RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
    var WAC = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");
    var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");

    var g = $rdf.graph();
    var f = $rdf.fetcher(g, TIMEOUT);
    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate=PROXY;

    // fetch user data
    f.nowOrWhenFetched($scope.aclURI,undefined,function(ok, body) {
      if (!ok) {
        console.log('Error -- could not fetch ACL file. Is the server available?');
        $scope.listLocation = false;
      }

      $scope.findModes = function(modes) {
        var ret = {"Read": false, "Write": false, "Append": false};
        if (modes !== undefined && modes.length > 0) {
          for (var i in modes) {
            if (modes[i] !== undefined) {
              mode = modes[i].object.uri.slice(modes[i].object.uri.indexOf('#')+1, modes[i].object.uri.length);
              if (mode == "Read") { ret.Read = true; }
              else if (mode == "Write") { ret.Write = true; }
              else if (mode == "Append") { ret.Append = true; }
            }
          }
        } 
        return ret;
      };
      
      $scope.trunc = function (str, size) {
        return (str.length > size+3)?str.slice(0, size)+'...':str;
      };
      
      var policies = g.statementsMatching(undefined, RDF("type"), WAC("Authorization"));
      if (policies.length > 0) {
        var i = 0;
        
        var owners = g.statementsMatching(undefined, WAC("owner"), undefined);
        console.log("Found owners: "+owners.length);
        if (owners !== undefined && owners.length > 0) {
          console.log("Got owners");
          for (i=0; i<owners.length;i++) {
            console.log(owners[i]);
            var owner = {};
            owner.policy = owners[i].subject.uri;
            owner.profile = {};
            getProfile(owners[i].object.uri, owner.profile);
            owner.modes = [];
            console.log(owner);
            owner.modes = $scope.findModes(g.statementsMatching(owners[i].subject, WAC("mode"), undefined));
            
            console.log(owner);
            $scope.owners.push(owner);
          }
        }
        
        var users  = g.statementsMatching(undefined, WAC("agent"), undefined);
        console.log("Found users: "+users.length);
        if (users !== undefined && users.length > 0) {
          for (i=0; i<users.length;i++) {
            var user = {};
            user.policy = users[i].subject.uri;
            user.profile = {};
            getProfile(users[i].object.uri, user.profile);
            user.modes = [];
            user.modes = $scope.findModes(g.statementsMatching(users[i].subject, WAC("mode"), undefined));
            
            $scope.users.push(user);
          }
        }
        
        var groups = g.statementsMatching(undefined, WAC("agentClass"), undefined);
        console.log("Found groups: "+groups.length);
        if (groups !== undefined && groups.length > 0) {
          for (i=0; i<groups.length;i++) {                         
            // add more info about the group
            var group = {};
            group.policy = groups[i].subject.uri;
            group.profile = {};
            getProfile(groups[i].object.uri, group.profile);
            group.modes = [];
            group.modes = $scope.findModes(g.statementsMatching(groups[i].subject, WAC("mode"), undefined));
            
            if (groups[i].object.uri === FOAF("Agent").uri) {
              $scope.others.push(group);
            } else {
              $scope.groups.push(group);
            }
          }
        }
        $scope.loading = false;
      }
    });
  }).
  error(function(data, status) {
    if (status == 401) {
      notify('Forbidden', 'Authentication required to change permissions for '+dirname(uri));
    } else if (status == 403) {
      notify('Forbidden', 'You are not allowed to change permissions for '+dirname(uri));
    } else {
      notify('Failed - HTTP '+status, data, 5000);
    }
  });
  
  $scope.ok = function () {
    $modalInstance.close();
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
};
