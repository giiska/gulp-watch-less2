# [gulp](http://gulpjs.com)-watch-less [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][depstat-image]][depstat-url]
> Gulp plugin for watching .less files and their @imports by [gulp-watch][watch-url], based on [Craga89/gulp-watch-less][url-watch-less] which is not work with gulp 3.9 and gulp4

## Install

```sh
$ npm install --save-dev gulp-watch-less2
```

## Important Note

**Add filter when `gulp.src` to watch less files**. E.g. `main-*.less` will ignore other less files (actually are just imports) excerpt filename start with `main-`.

The following changes will trigger task to recompile the `main-*.less` file.

  - Add new @import statement(s) to `main-*.less` file
  - Change less code in imported file of `main-*.less` file
  - Reorder the @import list in the `main-*.less` file
  - Delete @import statement(s) in the `main-*.less` file
  - Change less code in the `main-*.less` file


## Usage

```js
var gulp = require('gulp');
var watchLess = require('gulp-watch-less2');
var less = require('gulp-less');

var lessGlobs = 'less/main-*.less';

gulp.task('default', function () {
  return gulp.src(lessGlobs)
    .pipe(watchLess(lessGlobs, {verbose: true}))
    .pipe(less())
    .pipe(gulp.dest('dist'));
});
```


## API

### GulpWatchLess(glob, [options, callback])

Creates watcher that will spy on files that were matched by glob which can be a [`node-glob`][glob-url] string or array of strings.

**This will also watch all traced `@import` dependencies of the matched files, and re-emit a change event when any of them change**.
In this case, the `file.event` will be equal to `changed:by:import` for easy distinction.

Returns pass-through stream, that will emit vinyl files (with additional `event` property) that corresponds to event on file-system.

#### Callback `function(events, done)`

See documentation on [gulp-watch][watch-url] task

#### Options

See documentation on [gulp-watch][watch-url] task

##### options.less

Type: `object`  
Default: `{}`

*Optional* options passed through to the [less]().Parser instance.

## License

MIT &copy; [John Xiao][profile-url2]  
MIT &copy; [Craig Michael Thompson][profile-url]


[profile-url]: https://github.com/Craga89
[profile-url2]: https://github.com/bammoo

[glob-url]: https://github.com/isaacs/node-glob
[less-url]: https://github.com/less/less.js
[watch-url]: https://github.com/floatdrop/gulp-watch
[url-watch-less]: https://github.com/Craga89/gulp-watch-less
[plumber-url]: https://github.com/floatdrop/gulp-plumber

[npm-url]: https://npmjs.org/package/gulp-watch-less2
[npm-image]: http://img.shields.io/npm/v/gulp-watch-less2.svg?style=flat

[travis-url]: https://travis-ci.org/bammoo/gulp-watch-less2
[travis-image]: http://img.shields.io/travis/bammoo/gulp-watch-less2.svg?style=flat

[coveralls-url]: https://coveralls.io/r/bammoo/gulp-watch-less2
[coveralls-image]: http://img.shields.io/coveralls/bammoo/gulp-watch-less2.svg?style=flat

[depstat-url]: https://david-dm.org/bammoo/gulp-watch-less2
[depstat-image]: http://img.shields.io/david/bammoo/gulp-watch-less2.svg?style=flat

