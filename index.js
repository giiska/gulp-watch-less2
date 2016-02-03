'use strict';

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

var PLUGIN_NAME = 'gulp-watch-less2';
// Name of the event fired when @imports cause file to change
var changedByImptEvent = 'changed:by:import';


module.exports = function (glob, opts, callback) {
  // No-op callback if not given
  if (!opts) {
    opts = {};
  }
  if (!callback) {
    callback = function () {};
  }

  // Merge defaults
  opts = mergeDefaults(opts, {
    // ignoreInitial: false,
    name: 'watchLess',
    less: {},
    ignoreInitial: true
  });
  opts.events = ['add', 'change', 'unlink'];

  // used for push file base
  if (!opts.base) {
    opts.base = glob2base(new Glob(glob));
  }

  // Index each imports's parents, used to trigger changed:by:import event
  var _triggerIndex = Object.create(null);
  // Index imports by less files
  var _compileIndex = Object.create(null);

  // Generate a basic `gulp-watch` stream
  // Listen to `add, change, unlink` events
  // var watchStream = watch(glob, opts, callback)
  var watchStream = new Duplex({objectMode: true, allowHalfOpen: true});

  watchStream._write = function _write(file, enc, done) {
    callback(file);
    // event is undefined when ignored initial
    if (!file.event) {
      parseImports(file);
    }

    watchStream.push(file);
    done();
  };
  watchStream._read = function _read() {};
  watchStream.on('error', function(msg) {
    gutil.log(gutil.colors.red(PLUGIN_NAME + ' Error') , msg)
  })

  var watcher = chokidar.watch(glob, opts)
                        .on('all', watchHandler)
                        // Note: ready is no use at all cause watch will add imports when stream emit ready
                        // .on('ready', function () {
                        //   var count = 0;
                        //   var watchedPaths = watcher.getWatched();
                        //   Object.keys(watchedPaths).forEach(function (k) {
                        //     count += watchedPaths[k].length
                        //   })
                        // })
                        ;

  ['add', 'change', 'unlink', 'addDir', 'unlinkDir', 'error', 'ready', 'raw']
    .forEach(function (ev) {
      watcher.on(ev, watchStream.emit.bind(watchStream, ev));
    });
  watchStream.add = function add(newGlobs) {
    watcher.add(newGlobs, opts);
    // TODO: parseImports for newGlobs
  };
	watchStream.close = function (cb) {
		watcher.close();
		this.emit('end');
    cb && cb();
	}

  function parseImports(file) {
    var filePath = file.path;
    function handler(imports) {
      // not collect those who have no imports
      if (imports && imports.length) {
        imports.forEach(function (impt) {
          addImptIndexes(impt, filePath);
        });

        _compileIndex[filePath] = imports;
        watcher.add(imports, opts);
        watchStream.emit('importsReady', filePath)
        _log('watching', filePath + ' imports');
      }
    }
    getLessFileImports(file, handler);
  }

  function _streamPush(event, f) {
    // event limit to ['add', 'change', 'changed:by:import']
    f.event = event;
    watchStream.emit(event);
    watchStream.push(f);
    callback(f);
  }

  function watchHandler(event, filePath) {
    _log(event, filePath);
    if (event == 'add') {
      vinyl.read(filePath, opts).then(function (f) {
        parseImports(f);
        _streamPush(event, f);
      });
    }
    else if(event == 'change') {
      changeHandler(event, filePath);
    }
    else if(event == 'unlink') {
        filePath = pathIsAbsolute(filePath) ? filePath : path.join(opts.cwd || process.cwd(), filePath);
        removeTriggerIndexes(filePath);
        watchStream.emit('unlink');
    }
  }

  function changeHandler(event, filePath) {
    if (event === 'change' && typeof _triggerIndex[filePath] !== 'undefined') {
      var _thisTriggerList = _triggerIndex[filePath];
      // recompile associated less
      if (_thisTriggerList.length) {
        Object.keys(_thisTriggerList).forEach(function (k) {
          var lessFile = _thisTriggerList[k];
          changeHandler(changedByImptEvent, lessFile);
          _log(changedByImptEvent, lessFile);
        });
      }
      return;
    }

    vinyl.read(filePath, opts).then(function (f) {
      if (event == changedByImptEvent) {
        event = 'change'
      }
      else {
        detectImptChange(f);
      }
      _streamPush(event, f);
    });
  }

  function addImptIndexes(impt, filePath, watch) {
    if (typeof _triggerIndex[impt] === 'undefined') {
      _triggerIndex[impt] = [];
    }

    var lessList = _triggerIndex[impt];
    // no watched yet
    if (typeof lessList[filePath] === 'undefined') {
      lessList.push(filePath);
      if (watch)
        watcher.add(imptPath, opts);
    }
  }


  function removeImptIndexes(imptPath, filePath) {
    var lessList = _triggerIndex[imptPath];
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

  function _colorMagenta(text) {
    return gutil.colors.magenta(text);
  }

  function _log(event, filePath) {
    var msg;

    if (!opts.verbose)
      return;

    filePath = filePath.replace(opts.cwd || process.cwd() + '/', '');
    if(event == 'watching')
      msg = ['is', event, _colorMagenta(filePath)];
    else if (event == 'unwatched') {
      msg = [event, _colorMagenta(filePath)];
    }
    else {
      event = event[event.length - 1] === 'e' ? event + 'd' : event + 'ed';
      msg = ['saw', _colorMagenta(filePath), event];
    }

    if (opts.name) {
      msg.unshift(gutil.colors.cyan(opts.name));
    }

    gutil.log.apply(gutil, msg);
  }

  // Generates list of @import paths for a given Vinyl file
  function getLessFileImports(file, cb) {
    // Parse the filepath, using file path as `filename` option
    less.parse(file.contents.toString('utf8'), mergeDefaults({
      filename: file.path
    }, opts || {}), function (err, root, imports) {
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


  function detectImptChange(file) {
    var filePath = file.path;
    getLessFileImports(file, function (thisImports) {
      var previousImpts = _compileIndex[filePath] || [];
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
        // watch new imports
        thisImports.forEach(function (imptPath) {
          if (previousImpts.indexOf(imptPath) === -1) {
            // console.log('add new', imptPath)
            addImptIndexes(imptPath, filePath);
          }
        });
      }

      _compileIndex[filePath] = thisImports;
    });
  }

  function removeTriggerIndexes(filePath) {
    if (typeof _compileIndex[filePath] !== 'undefined') {
      delete _compileIndex[filePath];

      // Delete less index from imports list
      Object.keys(_triggerIndex).forEach(function (imptPath) {
        removeImptIndexes(imptPath, filePath);
      });
      // console.log(_compileIndex)
      // console.log(_triggerIndex)
    }
  }

  return watchStream;
}
