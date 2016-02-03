var fs = require('fs');
var watchLess = require('..');
var gutil = require('gulp-util');
var pj = require('path').join;
var touch = require('./touch.js');
var rimraf = require('rimraf');
var should = require('should');

function createVinyl(lessFileName, contents) {
  var base = pj(__dirname, 'fixtures');
  var filePath = pj(base, lessFileName);

  return new gutil.File({
    cwd: __dirname,
    base: base,
    path: filePath,
    contents: contents || fs.readFileSync(filePath)
  });
}

function fixtures(glob) {
  return pj(__dirname, 'fixtures', glob);
}

describe('api', function () {
  var watchStream;

  after(function (done) {
    watchStream.once('end', function () {
      rimraf.sync(fixtures('imports'));
      rimraf.sync(fixtures('new*'));
      done();
    });
    watchStream.close();
  })

  it('should emit added file', function (done) {
    watchStream = watchLess(fixtures('*/*.less'), {verbose: false});
    watchStream.add(fixtures('*.less'));
    watchStream.once('data', function (file) {
      file.relative.should.eql('new.less');
      file.event.should.eql('add');
      watchStream.close(done);
    })
    .once('ready', touch(fixtures('new.less')));
  });

  it('should emit change event on file change', function (done) {
    fs.mkdirSync(fixtures('imports'));
    fs.writeFileSync(fixtures('imports/1.less'), '.import {color: #fff;}');
    watchStream = watchLess(fixtures('*.less'), {verbose: false});
    watchStream.once('ready', touch(fixtures('new.less'), '@import "imports/1";.change{display:none;}'));
    watchStream.once('data', function (file) {
      file.relative.should.eql('new.less');
      file.event.should.eql('change');
      watchStream.close(done);
    });
  });

  it('should emit change event on import change', function (done) {
    watchStream = watchLess(fixtures('new.less'), {verbose: false});
    var file = createVinyl('new.less');
    watchStream.write(file);
    watchStream
      .once('data', function (file) {
        file.relative.should.eql('new.less');
        should.not.exist(file.event);
      })
      .once('importsReady', function (filePath) {
        // on new.less's imports are watched
        if(filePath == fixtures('new.less')) {
          this.once('data', function (file) {
            file.relative.should.eql('new.less');
            file.event.should.eql('change');
            done();
          })
          fs.writeFileSync(fixtures('imports/1.less'), '.import {color: #000;}');
        }
      })
  });


});
