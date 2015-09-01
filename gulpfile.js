var gulp    = require('gulp');
var eslint  = require('gulp-eslint');
var mocha   = require('gulp-mocha');
var runseq  = require('run-sequence');

var CODE_SRC = ['./index.js', './cli.js'];
var TEST_SRC = ['./test.js'];
var GULP_SRC = ['./gulpfile.js'];

gulp.task('lint', function lint() {
  return gulp.src([].concat(CODE_SRC, GULP_SRC))
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task('test', function test() {
  return gulp.src(TEST_SRC, { read: false }).pipe(mocha());
});

gulp.task('build', function buid() {
  return runseq('lint', 'test');
});

gulp.task('watch', ['build'], function watch() {
  gulp.watch(CODE_SRC, ['build']);
  gulp.watch(GULP_SRC, ['lint']);
  gulp.watch(TEST_SRC, ['test']);
});
