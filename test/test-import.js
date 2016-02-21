var fs = require('fs-extra');
var watchLess = require('..');
var gutil = require('gulp-util');
var pj = require('path').join;
var utils = require('./utils.js');
var should = require('should');

describe('api', function () {
  var watchStream;

  before(function(done) {
    fs.copySync(utils.fixtures('import'), utils.fixtures('import-tmp'))
    watchStream = watchLess(utils.fixtures('import-tmp/style-*.less'), {
      base: pj(__dirname, 'fixtures'),
      verbose: false
    });
      watchStream.once('importsReady', function (f) {
        if(f == utils.fixtures('import-tmp/style-new2.less')) {
          // Consume data event to avoid affectting latter test case
          watchStream.once('data', function (file) {
              done()
          })
        }
      })
    watchStream.write(utils.createVinyl('import-tmp/style-new2.less'));
  })

  after(function (done) {
    watchStream.once('end', function () {
      fs.removeSync(utils.fixtures('import-tmp'));
      done();
    });
    watchStream.close();
  })

  it('stream should emit event when change imported file of its imported file', function (done) {
    fs.writeFileSync(utils.fixtures('import-tmp/2.less'), '.test-2{color: #fff;}');
    watchStream.once('data', function (file) {
      process.nextTick(function() {
        file.relative.should.eql('import-tmp/style-new2.less');
        file.event.should.eql('change');
      })
      done()
    })
  });

  it('stream should not emit event when change previously imported file of its imported file', function (done) {
    fs.writeFileSync(utils.fixtures('import-tmp/1.less'), '//@import "import-tmp/2";');
    watchStream.once('data', function (file) {
      fs.writeFileSync(utils.fixtures('import-tmp/2.less'), '.test-2{color: #000;}');
      watchStream.once('data', function (file) {
        process.nextTick(function () {
          should.fail('Event should not be triggered');
        });
      });
      setTimeout(function () {
        done();
      }, 100);
    })
  });

});
