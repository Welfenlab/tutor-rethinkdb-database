var gulp = require('gulp');
var gutil = require('gulp-util');
var coffee = require('gulp-coffee');
var watch = require('gulp-watch');
var plumber = require('gulp-plumber');

gulp.task("build", function(){
  gulp.src('./src/**/*.coffee')
    .pipe(coffee({bare: true}).on('error', gutil.log))
    .pipe(gulp.dest('./lib/'))
});

gulp.task("watch", function(){
  gulp.src('./src/**/*.coffee')
    .pipe(watch('./src/**/*.coffee'))
    .pipe(plumber())
    .pipe(coffee({bare: true}).on('error', gutil.log))
    .pipe(gulp.dest('./lib/'))
});

gulp.task("default", ["build"]);
