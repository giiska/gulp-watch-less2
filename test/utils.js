var fs = require('fs');
var gutil = require('gulp-util');
var pj = require('path').join;

function createVinyl(lessFileName, contents) {
  var base = pj(__dirname, 'fixtures');
  var filePath = pj(base, lessFileName);

  return new gutil.File({
    cwd: __dirname,
    base: base,
    path: filePath,
    contents: contents || fs.readFileSync(filePath)
  });
};

function fixtures(glob) {
  return pj(__dirname, 'fixtures', glob);
}

function touch(path, content, cb) {
  if (typeof content === 'function') {
    cb = content;
    content = undefined;
  }

  cb = cb || function () {};

  return function () {
    fs.writeFileSync(path, content || '.wadap {color: #000;}');
    cb();
  };
};


module.exports = {
  createVinyl: createVinyl,
  fixtures: fixtures,
  touch: touch
}