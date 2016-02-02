
var watch = require('..');
var join = require('path').join;
var touch = require('./touch.js');
var rimraf = require('rimraf');
require('should');

function fixtures(glob) {
  return join(__dirname, 'fixtures', glob);
}

describe('api', function () {
  var w;

  describe('add', function () {
    afterEach(function (done) {
      w.on('end', function () {
        rimraf.sync(fixtures('new.less'));
        done();
      });
      w.close();
    });

    it('should emit added file', function (done) {
      w = watch(fixtures('*/*.less'));
      w.add(fixtures('*.less'));
      w.on('data', function (file) {
        file.relative.should.eql('new.less');
        file.event.should.eql('add');
        done();
      }).on('ready', touch(fixtures('new.less')));
    });

    it('should emit change event on file change', function (done) {
      w = watch(fixtures('*/*.less'));
      w.add(fixtures('*.less'));
      w.on('ready', touch(fixtures('index.less')));
      w.on('data', function (file) {
        file.relative.should.eql('index.less');
        file.event.should.eql('change');
        done();
      });
    });
  });
});
