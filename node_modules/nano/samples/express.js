var express = require('express')
   , db    = require('nano')('http://localhost:5984/my_couch')
   , app     = module.exports = express.createServer()
   ;

app.get("/", function(request,response) {
    db.get("foo", function (error, body, headers) {
      if(error) { return response.send(error.message, error['status-code']); }
      response.send(body, 200);
    });
  });
});

app.listen(3333);
console.log("server is running. check expressjs.org for more cool tricks");