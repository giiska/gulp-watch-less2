var fs = require('fs-extra');
var watchLess = require('..');
var gutil = require('gulp-util');
var pj = require('path').join;
var should = require('should');
var utils = require('./utils.js');

describe('api', function () {
  var watchStream;

  before(function (done) {
    fs.mkdirSync(utils.fixtures('api-tmp'));
    watchStream = watchLess(utils.fixtures('api-tmp/*.less'), {
      base: pj(__dirname, 'fixtures'),
      verbose: false
    });
    watchStream.once('ready', function() {
      done()
    })
  })

  after(function (done) {
    watchStream.once('end', function () {
      fs.removeSync(utils.fixtures('api-tmp'));
      done();
    });
    watchStream.close();
  })

  it('should emit added file', function (done) {
    watchStream.once('data', function (file) {
      process.nextTick(function() {
        file.relative.should.eql('api-tmp/new.less');
        file.event.should.eql('add');
        done()
      })
    })
    fs.writeFileSync(utils.fixtures('api-tmp/new.less'), '.ready{}')
  });

  it('should emit change event on file change', function (done) {
    watchStream.once('data', function (file) {
      process.nextTick(function() {
        file.relative.should.eql('api-tmp/new.less');
        file.event.should.eql('change');
        done()
      })
    });
    fs.writeFileSync(utils.fixtures('api-tmp/new.less'), '.change{}')
  });

});
