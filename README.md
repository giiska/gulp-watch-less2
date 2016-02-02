# [gulp](http://gulpjs.com)-watch-less [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][depstat-image]][depstat-url]
> Gulp plugin for watching .less files and their @imports, based on [chokidar][chokidar-url]

## Install

```sh
$ npm i -D gulp-watch-less2
```

> __Protip:__ until gulpjs 4.0 is released, you can use [gulp-plumber](https://github.com/floatdrop/gulp-plumber) to avoid watch process be terminated by errors.

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

## Important Note

  - **Use specific glob to filter import files**. E.g. `main-*.less` will ignore import files which filename is not start with `main-`.
  - Currently this plugin **only support one level imports**, that is to say you can not add imports statements in a import file.

The following changes will trigger to recompile the `main-*.less` file.

  - Add new @import statement(s) to `main-*.less` file
  - Change less code in imported file of `main-*.less` file
  - Reorder the @import list in the `main-*.less` file
  - Delete @import statement(s) in the `main-*.less` file
  - Change less code in the `main-*.less` file


## API

### GulpWatchLess(glob, [options, callback])

Returns pass-through stream, that will emit vinyl files (with additional `event` property) that corresponds to event on file-system.

#### glob

Glob can be a [`node-glob`][glob-url] string or array of strings.

#### Options

See documentation on [chokidar][chokidar-url] task

##### options.less

Type: `object`  
Default: `{}`

*Optional* options passed through to the [less]().Parser instance.

#### Callback `function(events, done)`

See documentation on [chokidar][chokidar-url] task


## License

MIT &copy; [John Xiao][profile-url]  


[profile-url]: https://github.com/bammoo

[glob-url]: https://github.com/isaacs/node-glob
[less-url]: https://github.com/less/less.js
[watch-url]: https://github.com/floatdrop/gulp-watch
[chokidar-url]: https://github.com/paulmillr/chokidar
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

