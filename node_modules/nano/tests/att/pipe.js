var fs       = require('fs')
  , path     = require('path') 
  , specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , nock     = helpers.nock
  , pixel    = helpers.pixel
  ;

var mock = nock(helpers.couch, "att/pipe")
  , db   = nano.use("att_pipe")
  ;

specify("att_pipe:setup", timeout, function (assert) {
  nano.db.create("att_pipe", function (err) {
    assert.equal(err, undefined, "Failed to create database");
  });
});

specify("att_pipe:write", timeout, function (assert) {
  var buffer   = new Buffer(pixel, 'base64')
    , filename = path.join(__dirname, '.temp.bmp')
    , ws       = fs.createWriteStream(filename)
    ;
    ws.on('close', function () {
      assert.equal(fs.readFileSync(filename).toString('base64'), pixel);
      fs.unlinkSync(filename);
    });
    db.attachment.insert("new", "att", buffer, "image/bmp", 
    function (error, bmp) {
      assert.equal(error, undefined, "Should store the pixel");
      db.attachment.get("new", "att", {rev: bmp.rev}).pipe(ws);
    });
});

specify("att_pipe:read", timeout, function (assert) {
  var logo = __dirname + "/../fixtures/logo.png"
    , rs   = fs.createReadStream(logo)
    , is   = db.attachment.insert("nodejs", "logo.png", null, "image/png")
    ;

  is.on('end', function () {
    db.attachment.get("nodejs", "logo.png", function (err, buffer) {
      assert.equal(err, undefined, "Should get the logo");
      assert.equal(
        fs.readFileSync(logo).toString('base64'), buffer.toString('base64'),
        "Data should remain unchanged");
    });
  });

  rs.pipe(is);
});

specify("att_pipe:teardown", timeout, function (assert) {
  nano.db.destroy("att_pipe", function (err) {
    assert.equal(err, undefined, "Failed to destroy database");
    assert.ok(mock.isDone(), "Some mocks didn't run");
  });
});

specify.run(process.argv.slice(2));
