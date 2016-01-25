'use strict';

var PLUGIN_NAME = 'gulp-watch-less2';

var gulp = require('gulp'),
	gutil = require('gulp-util'),
	vinyl = require('vinyl-file'),
	watch = require('gulp-watch'),
	mergeDefaults = require('lodash.defaults'),
	through = require('through2'),
	less = require('less');

// Generates list of @import paths for a given Vinyl file
function getLessFileImports(file, options, cb) {
	var imports = [];

	// Support (file, cb) signature
	if (typeof options === 'function') {
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
		var imports = Object.keys(imports.files).sort();

		cb(err, imports);
	});
};

// Tracks watch streams e.g. `{filepath}: stream`
var _streams = Object.create(null);

// Name of the event fired when @imports cause file to change
// (Overwrites the current file.event set by gulp-watch/gaze)
var changeEvent = 'changed:by:import';

// Import generator
function watchLessImports(file, options, cb) {
	var filePath = file.path;

	if (file.event === 'unlink') {
		cleanupWatchStream(file);
		return;
	}
	// Generate an @import list via LESS...
	getLessFileImports(file, options.less, function(err, imports) {
		var oldImports;

		// Emit the error if one was returned
		if (err) { cb(new gutil.PluginError(PLUGIN_NAME, err)); }

		// If a previous watch stream is active...
		var watchStream = _streams[filePath];
		if (watchStream) {
			oldImports = watchStream._imports;

			// Check to ensure the @import arrays are identical.
			if (oldImports.length && oldImports.join() === imports.join()) {
				return; // Don't do anything further!
			}

			cleanupWatchStream(file);
		}

		// If we found some imports...
		if (imports.length) {
			// Generate new watch stream
			watchStream = _streams[filePath] = watch(imports, options, cb);

			// Expose @import list on the stream
			watchStream._imports = imports;
		}
	});
}

function cleanupWatchStream(file) {
	var watchStream = _streams[file.path];
	
	if (watchStream) {
		watchStream.end();
		watchStream.unpipe();
		watchStream.close();
		
		delete _streams[file.path];
	}
}

module.exports = function (glob, options, callback) {
	// No-op callback if not given
	if (!options) { options = {}; }
	if (!callback) { callback = function() {}; }

	// Merge defaults
	options = mergeDefaults(options, {
		name: 'LESS', // Use LESS name by default
		less: {} // No LESS options by default
	});

	// Generate a basic `gulp-watch` stream
	var watchStream = watch(glob, options, function(file) {
		var filePath = file.path;

		// Make sure not watch again when `watchStream.push(f)`
		if (file.event !== changeEvent) {
			watchLessImports(file, options, function(importFile) {
				// Re push changed less
				vinyl.read(filePath, options, function(err, f) {
	        			if (err) {
						return watchStream.emit('error', err);
	        			}
	        			f.event = changeEvent;
					watchStream.push(f);
					callback(f);
				});
			});
		}

		callback(file);
	});

	// Close all import watch streams when the watchStream ends
	watchStream.on('end', function() { Object.keys(_streams).forEach(closeStream); });

	return watchStream;
};
