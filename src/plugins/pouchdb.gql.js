/*global Pouch: true */

"use strict";

// This is the first implementation of a basic plugin, we register the
// plugin object with pouch and it is mixin'd to each database created
// (regardless of adapter), adapters can override plugins by providing
// their own implementation. functions on the plugin object that start
// with _ are reserved function that are called by pouchdb for special
// notifications.

// If we wanted to store incremental views we can do it here by listening
// to the changes feed (keeping track of our last update_seq between page loads)
// and storing the result of the map function (possibly using the upcoming
// extracted adapter functions)

var MapReduce = function(db) {

  function viewQuery(query, options) {
    if (!options.complete) {
      return;
    }

    function sum(values) {
      return values.reduce(function(a, b) { return a + b; }, 0);
    }

    var results = [];
    var current = null;

    var selectFun= function(doc){
      var viewRow= {};

      if (!query.select || query.select == "" || query.select == "*"){
        viewRow= doc;
      } else {
        query.select.split(',').forEach(function(element){
          element= element.trim();
          viewRow[element]= doc[element];
        });
      }

      if(Object.keys(viewRow).length != 0){
        results.push(viewRow);
      }
    };

    var whereFun= function() {

      if (!query.where) {
        return function(){return true;};
      }

      var parsedTokens= function(){

        var lexedTokens= function(){
          var tokens = [], c, index = 0, currentString= "";

          function isOperator(c) { return /[=<>!+\-*\/()]/.test(c); }
          function isFullWordOperator(str) { return /and|or|not|where|select/.test(str);}
          function isBooleanLiteral(str) { return /true|false/.test(str);}
          function isDigit(c) { return /[0-9.]/.test(c); }
          function isWhiteSpace(c) { return /\s/.test(c); }
          function isIdentifier(c) { 
            return typeof c === "string" && !isOperator(c) && !isDigit(c) && !isWhiteSpace(c);
          }


          function LexerError(message) {
            this.name= "LexerError";
            this.message= message + " on character " + index + " of the where clause." || "Generic parsing error";
          }
          LexerError.prototype= new Error();
          LexerError.prototype.constructor= LexerError;

          //always ending with a space to simplify lexer parsing
          query.where += " ";

          function advance (){
            if(index < query.where.length) {
              c = query.where[index++];
              return true;
            }
            return false;
          }

          function addToken(type, value) {
            currentString= "";
            tokens.push({
              type: type,
              value: value
            });
          }

          function handleDelimitedCharacters(){
            if (currentString !== ""){
              //full-word operators, e.g. not, where
              if (isFullWordOperator(currentString.toLowerCase())){
                addToken(currentString.toLowerCase());
                //boolean literal
              } else if (isBooleanLiteral(currentString.toLowerCase())) {
                addToken("boolean", currentString.toLowerCase() === "true");
                //number literal
              } else if (isDigit(currentString[0])) {
                addToken("number", parseFloat(currentString));
              }else {
                addToken("identifier", currentString);
              }
            }
          }

          function pairedOperator(){
            addToken(c + query.where[index]);
            advance();
          }

          while (advance()) {
            //back quoted identifiers
            if (c === "`"){
              currentString= "";
              while (advance()) {
                if (c !== "'"){
                  currentString += c;
                } else {
                  addToken("identifier", currentString);
                }
              }
              throw new LexerError("Identifier needs a closing ` (backquote)");
            //non-word operators
            } else if (isOperator(c)) {
              handleDelimitedCharacters();
              switch (c){
                case "<":
                  if (query.where[index] === "=" || query.where[index] === ">"){
                    pairedOperator();
                  }
                  else
                    addToken(c);
                  break;

                case ">":
                  if (query.where[index] === "=")
                    pairedOperator();
                  else
                    addToken(c);
                  break;

                case "!":
                  if (query.where[index] === "=")
                    pairedOperator();
                  else
                    throw new LexerError("'!' not followed by '='");
                  break;

                default:
                  addToken(c);
                  break;
              }

            //end of some token
            } else if (isWhiteSpace(c)) { 
              handleDelimitedCharacters();
            } else {
              currentString += c;
            }
          }
          addToken("(end)");

          console.log(tokens);
          return tokens;
        }();

        var parseTree, symbolTable = {}, index= 0, token;

        function advance() {
          if (index < lexedTokens.length){
            token= interpretToken(lexedTokens[index++]);
            return true;
          }
          return false;
        }

        function peekToken(n) {
          n= n || 0;
          if (index + n < lexedTokens.length){
            return interpretToken(lexedTokens[index+n]);
          }
          return null;
        }

        function interpretToken(token) {
          var sym = Object.create(symbolTable[token.type]);
          sym.type= token.type;
          sym.value= token.value;
          return sym;
        }

        function symbol(id, nud, lbp, led) {
          var sym= symbolTable[id] || {};
          symbolTable[id]= {
            lbp: sym.lbp || lbp,
            nud: sym.nud || nud,
            led: sym.led || led
          };
        };

        function isFunction(name){
          return /max|min|sum/.test(name.toLowerCase());
        }

        function expression(rbp) {
          var left;
          advance();
          if (!token.nud) throw "Unexpected token: " + token.type;
          left= token.nud(token);
          while (rbp < peekToken().lbp) {
            advance();
            if (!token.led) throw "Unexpected token: " + token.type;
            left= token.led(left);
          }
          return left;
        }

        function infix(id, lbp, rbp, led) {
          rbp= rbp || lbp;
          symbol(id, null, lbp, led  || function (left) {
            return {
              type: id,
              left: left,
              right: expression(rbp)
            };
          });
        }

        function prefix(id, rbp) {
          symbol(id, function () {
            return {
              type: id,
              right: expression(rbp)
            };
          });
        }

        infix("+", 50);
        infix("-", 50);
        infix("*", 60);
        infix("/", 60);

        prefix("-", 70);

        infix("=", 40);
        infix("<", 40);
        infix("<=", 40);
        infix(">", 40);
        infix(">=", 40);
        infix("!=", 40);
        infix("<>", 40);

        infix("and", 30);
        infix("or", 30);
        infix("not", 31); //not totally sure about this...

        symbol(")");
        symbol("(end)");

        symbol("(", function () {
          value= expression(20);
          if (token.type !== ")") throw "Expected closing parenthesis ')'";
          advance();
          return value;
        });

        symbol("number", function(number) {
          return number;
        });
        symbol("boolean", function(bool) {
          return bool;
        });

        symbol("identifier", function(tok) {
          //here we allow for identifiers with the same name as functions
          if (isFunction(tok.value) && peekToken().type === "(") {
            var args= [];
            advance();
            while(advance()){

              if(peekToken().type === ")"){
                advance();
                return {
                  type: "call",
                  args: args,
                  name: tok.value
                };
              }
              args.push(expression(20));
            }
            throw "Expected closing parenthesis";
          }
          return tok;
        });

        //do {
          //parseTree.push(expression(0));
        //} while (peekToken().type !== "(end)");

        parseTree= expression(0);

        console.log(parseTree);
        return parseTree;
      }();

      var interpreter= function(doc){

        var operators = {
          "+": function(a, b) {
            return a + b;
          },
          "-": function(a, b) {
            if (typeof b === "undefined") return -a;
            return a - b;
          },
          "*": function(a, b) {
            return a * b;
          },
          "/": function(a, b) {
            return a / b;
          },
          "=": function(a, b) {
            return a === b;
          },
          "<": function(a, b) {
            return a < b;
          },
          "<=": function(a, b) {
            return a <= b;
          },
          ">": function(a, b) {
            return a > b;
          },
          ">=": function(a, b) {
            return a >= b;
          },
          "!=": function(a, b) {
            return a !== b;
          },
          "<>": function(a, b) {
            return a !== b;
          },
          "and": function(a, b) {
            return a && b;
          },
          "or": function(a, b) {
            return a || b;
          },
          "not": function(a) {
            return !a;
          }
        };


        function parseNode(node){
          switch (node.type) {
            case "boolean":
              return node.value;
              break;

            case "number":
              return node.value;
              break;

            case "identifier":
              if (typeof doc[node.value] === "undefined"){
                //is this the correct behavior?
                throw node.value + " is undefined in doc " + doc._id;
              }
              return doc[node.value];
              break;

            default:
              if (operators[node.type]) {
                if(node.left){
                  return operators[node.type](parseNode(node.left), parseNode(node.right));
                }
                return operators[node.type](parseNode(node.right));
              }
              console.log(operators[node.type]);
              console.log(node.type);
              console.log(operators["or"]);
              console.log(node);
              throw "Unknown token type";
              break;
          }
        }

        return parseNode(parsedTokens);
      }

      return interpreter;
    }();

    //var emit = function(key, val) {
      //var viewRow = {
        //id: current._id,
        //key: key,
        //value: val
      //}; 

      //if (options.startkey && Pouch.collate(key, options.startkey) < 0) return;
      //if (options.endkey && Pouch.collate(key, options.endkey) > 0) return;
      //if (options.key && Pouch.collate(key, options.key) !== 0) return;
      //num_started++;
      //if (options.include_docs) {
        ////in this special case, join on _id (issue #106)
        //if (val && typeof val === 'object' && val._id){
          //db.get(val._id,
              //function(_, joined_doc){
                //if (joined_doc) {
                  //viewRow.doc = joined_doc;
                //}
                //results.push(viewRow);
                //checkComplete();
              //});
          //return;
        //} else {
          //viewRow.doc = current.doc;
        //}
      //}
      //results.push(viewRow);
    //};

    function processDoc(doc){
      if (whereFun(doc)){
        selectFun(doc);
      }
    }

    //// exclude  _conflicts key by default
    //// or to use options.conflicts if it's set when called by db.query
    var conflicts = ('conflicts' in options ? options.conflicts : false);

    //only proceed once all documents are mapped and joined
    function checkComplete(){
      results.sort(function(a, b) {
        return Pouch.collate(a.key, b.key);
      });
      if (options.descending) {
        results.reverse();
      }

      return options.complete(null, {rows: results});
    };

    db.changes({
      conflicts: conflicts,
      include_docs: true,
      onChange: function(doc) {
        if (!('deleted' in doc)) {
          current = {doc: doc.doc};
          processDoc(doc.doc);
        }
      },
      complete: function() {
        checkComplete();
      }
    });
  }

  function httpQuery(fun, opts, callback) {

    // List of parameters to add to the PUT request
    var params = [];

    // If opts.reduce exists and is defined, then add it to the list
    // of parameters.
    // If reduce=false then the results are that of only the map function
    // not the final result of map and reduce.
    if (typeof opts.reduce !== 'undefined') {
      params.push('reduce=' + opts.reduce);
    }
    if (typeof opts.include_docs !== 'undefined') {
      params.push('include_docs=' + opts.include_docs);
    }
    if (typeof opts.limit !== 'undefined') {
      params.push('limit=' + opts.limit);
    }
    if (typeof opts.descending !== 'undefined') {
      params.push('descending=' + opts.descending);
    }
    if (typeof opts.startkey !== 'undefined') {
      params.push('startkey=' + encodeURIComponent(JSON.stringify(opts.startkey)));
    }
    if (typeof opts.endkey !== 'undefined') {
      params.push('endkey=' + encodeURIComponent(JSON.stringify(opts.endkey)));
    }
    if (typeof opts.key !== 'undefined') {
      params.push('key=' + encodeURIComponent(JSON.stringify(opts.key)));
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    // We are referencing a query defined in the design doc
    if (typeof fun === 'string') {
      var parts = fun.split('/');
      db.request({
        type:'GET',
        url: '_design/' + parts[0] + '/_view/' + parts[1] + params
      }, callback);
      return;
    }

    // We are using a temporary view, terrible for performance but good for testing
    var queryObject = JSON.stringify(fun, function(key, val) {
      if (typeof val === 'function') {
        return val + ''; // implicitly `toString` it
      }
      return val;
    });

    db.request({
      type:'POST',
      url: '_temp_view' + params,
      data: queryObject
    }, callback);
  }

  function query(fun, opts, callback) {

    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (callback) {
      opts.complete = callback;
    }

    if (db.type() === 'http') {
      return httpQuery(fun, opts, callback);
    }


    if (typeof fun === 'object') {
      return viewQuery(fun, opts);
    }

    var parts = fun.split('/');
    db.get('_design/' + parts[0], function(err, doc) {
      if (err) {
        if (callback) callback(err);
        return;
      }
      viewQuery({
        map: doc.views[parts[1]].map,
        reduce: doc.views[parts[1]].reduce
      }, opts);
    });
  }

  return {'query': query};
};

// Deletion is a noop since we dont store the results of the view
MapReduce._delete = function() { };

Pouch.plugin('mapreduce', MapReduce);
