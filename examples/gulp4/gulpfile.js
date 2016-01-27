'use strict';

var gulp = require('gulp'),
  del = require('del'),
  less = require('gulp-less'),
  postcss = require('gulp-postcss'),
  autoprefixer = require('autoprefixer'),
  cssnano = require('gulp-cssnano'),
  watchLess = require("../../index");

function clean() {
  return del('dist/*');
}

function lessTask() {
  // only compile less start with `style-`
  return gulp.src(['src/less/style-*'])
    .pipe(watchLess('src/less/style-*'))
    .pipe(less())
    .pipe(postcss([autoprefixer({browsers: ['last 5 versions']})]))
    .pipe(cssnano())
    .on('error', function (error) {
      console.log(error.message);
    })
    .pipe(gulp.dest('dist/css/'))
}

gulp.task('default', gulp.series(
  clean,
  lessTask
));