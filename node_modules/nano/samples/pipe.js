var express = require('express')
  , nano    = require('nano')('http://localhost:5984')
  , app     = module.exports = express.createServer()
  , db_name = "test"
  , db      = nano.use(db_name);

app.get("/", function(request,response) {
  db.attachment.get("new", "logo.png").pipe(response);
});

app.listen(3333);