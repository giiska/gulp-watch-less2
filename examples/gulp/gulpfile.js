'use strict';

var gulp = require('gulp'),
  del = require('del'),
  less = require('gulp-less'),
  watchLess = require("../../index");

gulp.task('del', function () {
  return del('css_build/*');
})
gulp.task('default', ['del'], function () {
  // only compile less start with `style-`
  return gulp.src(['less/style-*'])
    .pipe(watchLess('less/style-*'))
    .pipe(less())
    .on('error', function (error) {
      console.log(error.message);
    })
    .pipe(gulp.dest('css_build/'))
});