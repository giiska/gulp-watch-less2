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
var getLessImports = require('get-less-imports');

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
  var _importsIndex = Object.create(null);
  var _subImportsIndex = Object.create(null);

  var watchStream = new Duplex({objectMode: true, allowHalfOpen: true});

  watchStream._write = function _write(file, enc, done) {
    callback(file);
    // event is undefined when ignored initial
    if (!file.event) {
      addHandler(file);
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
    watcher.add(newGlobs);
    // TODO: addHandler for newGlobs
  }
	watchStream.close = function (cb) {
		watcher.close();
		this.emit('end');
    cb && cb();
	}

  function addTriggerMap(impt, filePath, needWatch) {
    if (typeof _triggerIndex[impt] === 'undefined') {
      _triggerIndex[impt] = [];
    }

    var parentList = _triggerIndex[impt];
    // no watched yet
    if ( parentList.indexOf(filePath) === -1) {
      parentList.push(filePath);
      if (needWatch) {
        watcher.add(impt);
      }
    }
  }

  function addHandler(file) {
    var filePath = file.path;

    var imports = getLessImports(filePath);
    var importsSimple = imports.simple;

    Object.keys(imports.full).forEach(function (k) {
      if(k != filePath)
        _subImportsIndex[k] = imports.full[k]
    })

    // not collect those who have no imports
    if (importsSimple && importsSimple.length) {
      importsSimple.forEach(function (impt) {
        addTriggerMap(impt, filePath);
      });

      _importsIndex[filePath] = importsSimple;
      watcher.add(importsSimple);
      watchStream.emit('importsReady', filePath);
      _log('watching', filePath + ' imports');
    }
  }

  function _streamPush(event, f) {
    // event limit to ['add', 'change', 'changed:by:import']
    f.event = event;
    watchStream.push(f);
    callback(f);
  }

  function watchHandler(event, filePath) {
    _log(event, filePath);
    if (event == 'add') {
      vinyl.read(filePath, opts).then(function (f) {
        addHandler(f);
        _streamPush(event, f);
      });
    }
    else if(event == 'change') {
      changeHandler(event, filePath);
    }
    else if(event == 'unlink') {
      filePath = pathIsAbsolute(filePath) ? filePath : path.join(opts.cwd || process.cwd(), filePath);
      removeAllTriggerIndex(filePath);
      watchStream.emit('unlink');
    }
  }

  function changeHandler(event, filePath) {
    if (typeof _triggerIndex[filePath] !== 'undefined') {
      var parentList = _triggerIndex[filePath];
      // recompile associated less
      if (parentList.length) {
        Object.keys(parentList).forEach(function (k) {
          var parentFilePath = parentList[k];
          changeHandler(changedByImptEvent, parentFilePath);
          _log(changedByImptEvent, parentFilePath);
        });
      }

      // If import file has sub imports
      if (typeof _subImportsIndex[filePath] !== 'undefined') {
        var previousImpts = _subImportsIndex[filePath];

        vinyl.read(filePath, opts).then(function (f) {
          var thisImports = getLessImports(filePath).simple;
          // Add/Rename/Order imports statement in imports file
          if (parentList.length && previousImpts.join() !== thisImports.join()) {
            // Recursively trigger top level less detectImptChange
            Object.keys(parentList).forEach(function (k) {
              var parentFilePath = parentList[k];
              detectImptChange(parentFilePath);
            });
          }
        })
      }

      return;
    }

    vinyl.read(filePath, opts).then(function (f) {
      if (event == changedByImptEvent) {
        event = 'change'
      }
      else {
        detectImptChange(filePath);
      }
      _streamPush(event, f);
    });
  }

  function deleteTriggerIndex(imptPath, filePath) {
    var lessList = _triggerIndex[imptPath];
    var pos = lessList.indexOf(filePath);
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

  // Detect imports change from top level less file
  function detectImptChange(filePath) {
    var imports = getLessImports(filePath);
    Object.keys(imports.full).forEach(function (k) {
      if(k != filePath)
        _subImportsIndex[k] = imports.full[k]
    })
    var thisImports = imports.simple;
    
    var previousImpts = _importsIndex[filePath] || [];

    // check identical
    if (previousImpts.join() !== thisImports.join()) {
      // unwatch removed
      previousImpts.forEach(function (imptPath) {
        if (thisImports.indexOf(imptPath) === -1) {
          deleteTriggerIndex(imptPath, filePath);
        }
      });
      // watch new imports
      thisImports.forEach(function (imptPath) {
        if (previousImpts.indexOf(imptPath) === -1) {
          addTriggerMap(imptPath, filePath, 1);
        }
      });
    }

    _importsIndex[filePath] = thisImports;
  }

  function removeAllTriggerIndex(filePath) {
    if (typeof _importsIndex[filePath] !== 'undefined') {
      delete _importsIndex[filePath];

      // Delete less index from imports list
      Object.keys(_triggerIndex).forEach(function (imptPath) {
        deleteTriggerIndex(imptPath, filePath);
      });
    }
  }

  return watchStream;
}
