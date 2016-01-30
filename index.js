'use strict';

var PLUGIN_NAME = 'gulp-watch-less2';

var gulp = require('gulp'),
    path = require('path'),
	gutil = require('gulp-util'),
  Duplex = require('readable-stream').Duplex,
    pathIsAbsolute = require('path-is-absolute'),
	vinyl = require('vinyl-file'),
	watch = require('gulp-watch'),
    glob2base = require('glob2base'),
	mergeDefaults = require('lodash.defaults'),
	chokidar = require('chokidar'),
	Glob = require('glob').Glob,
	through = require('through2'),
	less = require('less');

// Generates list of @import paths for a given Vinyl file
function getLessFileImports(file, options, cb) {
	var imports = [];

	// Support (file, cb) signature
	if(typeof options === 'function') {
		cb = options; options = null;
	}

	// Parse the filepath, using file path as `filename` option
	less.parse(file.contents.toString('utf8'), mergeDefaults({
		filename: file.path
	},
	options || {}),
	function(err, root, imports, options) {
		// Add a better error message / properties
		if (err) {
			err.lineNumber = err.line;
			err.fileName = err.filename;
			err.message = err.message + ' in file ' + err.fileName + ' line no. ' + err.lineNumber;
		}

		// Generate imports list from the files hash (sorted)
    var length = Object.keys(imports.files).length;
    var imports = Object.keys(imports.files).sort();
    imports.length = length;

		cb(err, imports);
	});
};

var _importIndex = Object.create(null);
var _lessIndex = Object.create(null);

// Name of the event fired when @imports cause file to change
// (Overwrites the current file.event set by gulp-watch/gaze)
var changedByImptEvent = 'changed:by:import';

module.exports = function (glob, options, callback) {
	// No-op callback if not given
	if(!options) { options = {}; }
	if(!callback) { callback = function() {}; }

	// Merge defaults
	options = mergeDefaults(options, {
		// ignoreInitial: false,
		name: PLUGIN_NAME,
		less: {},
		ignoreInitial: true
	});
	options.events = ['add', 'change', 'unlink'];

	// used for push file base
  if (!options.base) {
      options.base = glob2base(new Glob(glob));
  }

	// Generate a basic `gulp-watch` stream
	// Listen to `add, change, unlink` events
	// var watchStream = watch(glob, options, callback)
	var watchStream = new Duplex({objectMode: true, allowHalfOpen: true});

  watchStream._write = function _write(file, enc, done) {
      callback(file);
			// watchLessImports(file, options, importCallback);
      // console.log('_write', file.event)
      // event is undefined for ignored initial
      if(!file.event)
        initWatchImpt(file);

      watchStream.push(file);
      done();
  }
  watchStream._read = function _read(n) {}

  function removeImptIndexes(imptPath, filePath) {
    var lessList = _importIndex[imptPath];
    var pos = lessList.indexOf(filePath);
    console.log(imptPath, filePath, pos)
    if(pos > -1) {
      lessList.splice(pos, 1);
    }
    // unwatch impt when no less use it
    if(!lessList.length) {
      watcher.unwatch(imptPath)
      gutil.log('unwatched ', gutil.colors.magenta(imptPath))
    }
  }

  function removeIndexes(filePath) {
    if(typeof _lessIndex[filePath] !== 'undefined') {
      delete _lessIndex[filePath];

      // Delete less index from imports list
      Object.keys(_importIndex).forEach(function(imptPath) {
        removeImptIndexes(imptPath, filePath)
      })
      // console.log(_lessIndex)
      // console.log(_importIndex)
    }
  }

  function detectImptChange(file) {
    var filePath = file.path;
    getLessFileImports(file, function(err, thisImports) {
      var previousImpts = _lessIndex[filePath] || [];
      if(!thisImports)
        thisImports = [];
  
      // check identical
      if(previousImpts.join() !== thisImports.join()) {
        // unwatch removed
        previousImpts.forEach(function(imptPath) {
          if(thisImports.indexOf(imptPath) === -1) {
            console.log('remove old', imptPath)
            removeImptIndexes(imptPath, filePath)
          }
        })
        thisImports.forEach(function(imptPath) {
          if(previousImpts.indexOf(imptPath) === -1) {
            console.log('add new', imptPath)
            addImptIndexes(imptPath, filePath)
            watcher.add(imptPath, options);
          }
        })
      }

      _lessIndex[filePath] = thisImports;
    })
  }

  function addImptIndexes(impt, filePath) {
    if(typeof _importIndex[impt] === 'undefined') {
      _importIndex[impt] = [];
    }

    var lessList = _importIndex[impt];
    // no watched yet
    if(typeof lessList[filePath] === 'undefined') {
      lessList.push(filePath);
    }
  }

  function initWatchImpt(file) {
    var filePath = file.path;
    function handler(err, imports) {
      if(imports && imports.length) {
        // console.log(Object.keys(imports), filePath)
        imports.forEach(function(impt) {
          addImptIndexes(impt, filePath)
        })

        // not collect those who have no imports
        _lessIndex[filePath] = imports;
        // console.log('watching ', imports)
        watcher.add(imports, options);
        log('watch', filePath + ' imports');
        // console.log(_lessIndex)
        // console.log(_importIndex)
      }
    }
    getLessFileImports(file, handler)
  }


  var changeHandle = function(f) {
  }

  function pushWatchStreamFile(event, f) {
    f.event = event
    watchStream.push(f);
    // event limit to ['add', 'change', 'changed:by:import']
    watchStream.emit(event);
    // console.log(event, filePath)
    callback(f);
  }

	function pushFile(event, filePath) {
    log(event, filePath);

    if(event === 'change' && typeof _importIndex[filePath] !== 'undefined') {
      var relativeLess = _importIndex[filePath]
      // recompile associated less
      if(relativeLess.length) {
        Object.keys(relativeLess).forEach(function(k) {
          var lessFile = relativeLess[k];
          pushFile(changedByImptEvent, lessFile)
        })
      }
      return;
    }

		vinyl.read(filePath, options).then(function(f) {
      switch(event) {
        case 'add':
          initWatchImpt(f)
          break;
        case 'change':
          detectImptChange(f);
          break;
        case changedByImptEvent:
          event = 'change';
          break;
      }

      pushWatchStreamFile(event, f)

    });
	}

  function watchHandler(event, filePath) {
    
    switch(event) {
      case 'add':
      case 'change':
        pushFile(event, filePath)
        break;
      case 'unlink':
        filePath = pathIsAbsolute(filePath) ? filePath : path.join(options.cwd || process.cwd(), filePath);
        removeIndexes(filePath);
        log(event, filePath);
        watchStream.emit('unlink');
        break;
    }

  }

  function log(event, filePath) {
      event = event[event.length - 1] === 'e' ? event + 'd' : event + 'ed';

      var msg = [gutil.colors.magenta(filePath), 'was', event];

      if (options.name) {
          msg.unshift(gutil.colors.cyan(options.name) + ' saw');
      }

      gutil.log.apply(gutil, msg);
  }

  var watcher = chokidar.watch(glob, options)
  	                    .on('all', watchHandler)
                        // Note: ready is no use at all cause watch.add imports
                        // .on('ready', function() {
                        //   var count = 0;
                        //   var watchedPaths = watcher.getWatched();
                        //   Object.keys(watchedPaths).forEach(function(k) {
                        //     count += watchedPaths[k].length
                        //   })
                        //   gutil.log(PLUGIN_NAME, 'is watching ', gutil.colors.magenta(count), 'less files')
                        // })

	return watchStream;
}