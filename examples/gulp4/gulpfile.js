'use strict';

var gulp = require('gulp'),
  del = require('del'),
  less = require('gulp-less'),
  postcss = require('gulp-postcss'),
  autoprefixer = require('autoprefixer'),
  watch = require('gulp-watch'),
  cssnano = require('gulp-cssnano'),
  watchLess = require("../../index");
  var plumber = require('gulp-plumber');

function clean() {
  return del('dist/*');
}

// var watchGlob = 'src/**/style-*.less';
// var watchGlob = 'src/css/style-*.less';
var watchGlob = 'src/less/style-*.less';

function lessTask() {
  // only compile less which filename start with `style-`
  return gulp.src(watchGlob)
    // .pipe(plumber())
    .pipe(watchLess(watchGlob, {verbose: true}, function(f) {
      // console.log('watchless cb from gulpfile ', f.event)
    }))
    // .pipe(watch(watchGlob, {verbose: true}))
    .on('data', function(f) {
      // console.log('data', f.contents.toString())
      console.log('data', f.relative)
    })
    .pipe(less())
    // .pipe(postcss([autoprefixer({browsers: ['last 5 versions']})]))
    // .pipe(cssnano())
    .on('error', function (error) {
      console.log(error.message);
    })
    .pipe(gulp.dest('dist/css/'))
}

gulp.task('default', gulp.series(
  clean,
  lessTask
));