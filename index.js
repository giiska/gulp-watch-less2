'use strict';

var PLUGIN_NAME = 'gulp-watch-less2';

var path = require('path');
var gutil = require('gulp-util');
var Duplex = require('readable-stream').Duplex;
var pathIsAbsolute = require('path-is-absolute');
var vinyl = require('vinyl-file');
var glob2base = require('glob2base');
var mergeDefaults = require('lodash.defaults');
var chokidar = require('chokidar');
var Glob = require('glob').Glob;
var less = require('less');

var _importIndex = Object.create(null);
var _lessIndex = Object.create(null);

// Name of the event fired when @imports cause file to change
// (Overwrites the current file.event set by gulp-watch/gaze)
var changedByImptEvent = 'changed:by:import';

module.exports = function (glob, options, callback) {
  // No-op callback if not given
  if (!options) {
    options = {};
  }
  if (!callback) {
    callback = function () {};
  }

  // Merge defaults
  options = mergeDefaults(options, {
    // ignoreInitial: false,
    name: 'watchLess',
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
    if (!file.event) {
      initWatchImpt(file);
    }

    watchStream.push(file);
    done();
  };
  watchStream._read = function _read() {};
  watchStream.on('error', function(msg) {
    gutil.log(gutil.colors.red(PLUGIN_NAME + ' Error') , msg)
  })

  var watcher = chokidar.watch(glob, options)
                        .on('all', watchHandler)
                        // Note: ready is no use at all cause watch.add imports
                        // .on('ready', function () {
                        //   var count = 0;
                        //   var watchedPaths = watcher.getWatched();
                        //   Object.keys(watchedPaths).forEach(function (k) {
                        //     count += watchedPaths[k].length
                        //   })
                        //   gutil.log(PLUGIN_NAME, 'is watching ', gutil.colors.magenta(count), 'less files')
                        // })
                        ;

  ['add', 'change', 'unlink', 'addDir', 'unlinkDir', 'error', 'ready', 'raw']
    .forEach(function (ev) {
      watcher.on(ev, watchStream.emit.bind(watchStream, ev));
    });
  watchStream.add = function add(newGlobs) {
    watcher.add(newGlobs, options);
  };
	watchStream.close = function () {
		watcher.close();
		this.emit('end');
	};

  // Generates list of @import paths for a given Vinyl file
  function getLessFileImports(file, options, cb) {
    // Support (file, cb) signature
    if (typeof options === 'function') {
      cb = options; options = null;
    }

    // Parse the filepath, using file path as `filename` option
    less.parse(file.contents.toString('utf8'), mergeDefaults({
      filename: file.path
    }, options || {}), function (err, root, imports) {
      // Add a better error message / properties
      if (err) {
        err.lineNumber = err.line;
        err.fileName = err.filename;
        err.message = err.message + ' in file ' + err.fileName + ' line no. ' + err.lineNumber;

        // Emit the error if one was returned
        watchStream.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
      }
      else {
	      // Generate imports list from the files hash (sorted)
	      var length = Object.keys(imports.files).length;
	      imports = Object.keys(imports.files).sort();
	      imports.length = length;

	      cb(imports);
      }

    });
  }

  function removeImptIndexes(imptPath, filePath) {
    var lessList = _importIndex[imptPath];
    var pos = lessList.indexOf(filePath);
    // console.log(imptPath, filePath, pos)
    if (pos > -1) {
      lessList.splice(pos, 1);
    }
    // unwatch impt when no less use it
    if (!lessList.length) {
      watcher.unwatch(imptPath);
      _log('unwatched', imptPath);
    }
  }

  function removeIndexes(filePath) {
    if (typeof _lessIndex[filePath] !== 'undefined') {
      delete _lessIndex[filePath];

      // Delete less index from imports list
      Object.keys(_importIndex).forEach(function (imptPath) {
        removeImptIndexes(imptPath, filePath);
      });
      // console.log(_lessIndex)
      // console.log(_importIndex)
    }
  }

  function detectImptChange(file) {
    var filePath = file.path;
    getLessFileImports(file, function (thisImports) {
      var previousImpts = _lessIndex[filePath] || [];
      if (!thisImports) {
        thisImports = [];
      }

      // check identical
      if (previousImpts.join() !== thisImports.join()) {
        // unwatch removed
        previousImpts.forEach(function (imptPath) {
          if (thisImports.indexOf(imptPath) === -1) {
            // console.log('remove old', imptPath)
            removeImptIndexes(imptPath, filePath);
          }
        });
        thisImports.forEach(function (imptPath) {
          if (previousImpts.indexOf(imptPath) === -1) {
            // console.log('add new', imptPath)
            addImptIndexes(imptPath, filePath);
            watcher.add(imptPath, options);
          }
        });
      }

      _lessIndex[filePath] = thisImports;
    });
  }

  function addImptIndexes(impt, filePath) {
    if (typeof _importIndex[impt] === 'undefined') {
      _importIndex[impt] = [];
    }

    var lessList = _importIndex[impt];
    // no watched yet
    if (typeof lessList[filePath] === 'undefined') {
      lessList.push(filePath);
    }
  }

  function initWatchImpt(file) {
    var filePath = file.path;
    function handler(imports) {
      if (imports && imports.length) {
        // console.log(Object.keys(imports), filePath)
        imports.forEach(function (impt) {
          addImptIndexes(impt, filePath);
        });

        // not collect those who have no imports
        _lessIndex[filePath] = imports;
        // console.log('watching ', imports)
        watcher.add(imports, options);
        _log('watching', filePath + ' imports');
        // console.log(_lessIndex)
        // console.log(_importIndex)
      }
    }
    getLessFileImports(file, handler);
  }

  function pushFile(event, filePath) {
    // _log(event, filePath);

    if (event === 'change' && typeof _importIndex[filePath] !== 'undefined') {
      var relativeLess = _importIndex[filePath];
      // recompile associated less
      if (relativeLess.length) {
        Object.keys(relativeLess).forEach(function (k) {
          var lessFile = relativeLess[k];
          pushFile(changedByImptEvent, lessFile);
          _log(changedByImptEvent, lessFile);
        });
      }
      return;
    }

    function _push(event, f) {
      // event limit to ['add', 'change', 'changed:by:import']
      f.event = event;
      watchStream.emit(event);
      watchStream.push(f);
      callback(f);
    }

    vinyl.read(filePath, options).then(function (f) {
      switch (event) {
        case 'add':
          initWatchImpt(f);
          break;
        case 'change':
          detectImptChange(f);
          break;
        case changedByImptEvent:
          event = 'change';
          break;
        default:
          break;
      }

      _push(event, f);
    });
  }

  function watchHandler(event, filePath) {
    switch (event) {
      case 'add':
      case 'change':
        _log(event, filePath);
        pushFile(event, filePath);
        break;
      case 'unlink':
        filePath = pathIsAbsolute(filePath) ? filePath : path.join(options.cwd || process.cwd(), filePath);
        removeIndexes(filePath);
        _log(event, filePath);
        watchStream.emit('unlink');
        break;
      default:
        break;
    }
  }

  function _colorMagenta(text) {
    return gutil.colors.magenta(text);
  }

  function _log(event, filePath) {
    var msg;

    if (!options.verbose)
      return;

    filePath = filePath.replace(options.cwd || process.cwd() + '/', '');
    if(event == 'watching')
      msg = ['is', event, _colorMagenta(filePath)];
    else if (event == 'unwatched') {
      msg = [event, _colorMagenta(filePath)];
    }
    else {
      event = event[event.length - 1] === 'e' ? event + 'd' : event + 'ed';
      msg = ['saw', _colorMagenta(filePath), event];
    }

    if (options.name) {
      msg.unshift(gutil.colors.cyan(options.name));
    }

    gutil.log.apply(gutil, msg);
  }

  return watchStream;
}
