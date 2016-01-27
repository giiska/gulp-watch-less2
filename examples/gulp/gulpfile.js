'use strict';

var gulp = require('gulp'),
  del = require('del'),
  less = require('gulp-less'),
  watchLess = require("../../index");

var lessGlobs = ['less/style-*', 'less/**/style-*'];
// var lessGlobs = ['less/**/*', '!less/**/0*', '!less/**/1*', '!less/**/2*'];

gulp.task('del', function () {
  return del('css_build/*');
})
gulp.task('default', ['del'], function () {
  // only compile less start with `style-`
  return gulp.src(lessGlobs)
    .pipe(watchLess(lessGlobs, {verbose: true}))
    .pipe(less())
    .on('error', function (error) {
      console.log(error.message);
    })
    .pipe(gulp.dest('css_build/'))
});