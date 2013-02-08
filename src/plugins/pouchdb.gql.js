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

var GQL= function(db) {

  function viewQuery(query, options) {
    if (!options.complete) {
      return;
    }

    function sum(values) { return values.reduce(function(a, b) { return a + b; }, 0);
    }

    var results = [];
    var columns= [];
    var count;
    var summation;

    function parse(queryString){

      var lexedTokens= function(){
        var tokens = [], c, index = 0, currentString= "";

        function isOperator(c) { return /[=<>!+\-*\/(),]/.test(c); }
        function isFullWordOperator(str) { return /^and$|^or$|^not$|^where$|^select$/.test(str);}
        function isBooleanLiteral(str) { return /true|false/.test(str);}
        function isDigit(c) { return /[0-9.]/.test(c); }
        function isWhiteSpace(c) { return /\s/.test(c); }

        function LexerError(message) {
          this.name= "LexerError";
          this.message= message + " on character " + index + " of the where clause." || "Generic parsing error";
        }
        LexerError.prototype= new Error();
        LexerError.prototype.constructor= LexerError;

        //always ending with a space to simplify lexer parsing
        queryString += " ";

        function advance (){
          if(index < queryString.length) {
            c = queryString[index++];
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
          addToken(c + queryString[index]);
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
                if (queryString[index] === "=" || queryString[index] === ">"){
                  pairedOperator();
                }
                else
                  addToken(c);
                break;

              case ">":
                if (queryString[index] === "=")
                  pairedOperator();
                else
                  addToken(c);
                break;

              case "!":
                if (queryString[index] === "=")
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

      var parseTree= [], symbolTable = {}, index= 0, token;

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
        return /max|min|sum|lower|upper/.test(name.toLowerCase());
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
      prefix("not", 70); //TODO: not totally sure about this...

      symbol(")");
      symbol("(end)");

      symbol("(", function () {
        var value= expression(20);
        if (peekToken().type !== ")") throw "Expected closing parenthesis ')'";
        advance();
        return value;
      });

      symbol("number", function(number) {
        return number;
      });
      symbol("boolean", function(bool) {
        return bool;
      });

      symbol(",", function() {
        //commas are used to separate independent statements
        return expression(20);
      });

      symbol("identifier", function(tok) {
        //here we allow for identifiers with the same name as functions
        if (isFunction(tok.value) && peekToken().type === "(") {
          var args= [];
          while(advance()){
            if(token.type === ")"){
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

      do {
        parseTree.push(expression(0));
      } while (peekToken().type !== "(end)");

      //parseTree= expression(0);

      console.log(parseTree);
      return parseTree;
    }

    var selectFun= function(){

      if (!query.select || query.select == "" || query.select == "*"){
        return function(doc){results.push(doc);};
      }
      //query.select.split(',').forEach(function(element){
        //element= element.trim();

        //columns.push(element);
      //});


      var parsedTokens= parse(query.select);

      //var selector= function(doc){
        //var viewRow= {};

        //columns.forEach(function(column){
          //viewRow[column]= doc[column];
        //});

        //if(Object.keys(viewRow).length != 0){
          //results.push(viewRow);
          //}
          //}

          var interpreter= function(){

            var viewRow= [];
            var evaluator;
            var tracking= {};

            var operators = {
              "+": function(a, b) { return a + b; },
              "-": function(a, b) {
                if (typeof b === "undefined") return -a;
                return a - b;
              },
              "*": function(a, b) { return a * b; }, 
              "/": function(a, b) { return a / b; },
              "=": function(a, b) { return a === b; },
              "<": function(a, b) { return a < b; },
              "<=": function(a, b) { return a <= b; },
              ">": function(a, b) { return a > b; },
              ">=": function(a, b) { return a >= b; },
              "!=": function(a, b) { return a !== b; },
              "<>": function(a, b) { return a !== b; },
              "and": function(a, b) { return a && b; },
              "or": function(a, b) { return a || b; },
              "not": function(a) { return !a; }
            };

            var functions= {
              upper: function(str){return str.toUpperCase();},
              lower: function(str){return str.toLowerCase();},
              max: function(val, identifier){return tracking["max"][identifier](val);},
              min: function(val, identifier){return tracking.min[identifier](val);},
              average: function(val, identifier){return tracking.average[identifier](val);},
              count: function(val, identifier){return tracking.count[identifier](val);},
              sum: function(val, identifier){return tracking.sum[identifier](val);},
            };

            function isAggregator(str){return /max|average|min|sum|count/.test(str);}

            function containsAggregator(){
              var aggregators= []

              function recur(parentNode){
                if (!parentNode){
                  return;
                }
                if (parentNode.type === "call" && isAggregator(parentNode.name)){
                  aggregators.push(parentNode);
                  return;
                }
                recur(parentNode.left);
                recur(parentNode.right);
              }

              parsedTokens.forEach(function(node) {
                if(recur(node)){
                  return true;
                }
              });

              if (aggregators.length){
                return aggregators;
              }
              return null;
            }

            //TODO: will need to be modified to support group-by
            function containsIdentifierWithoutAggregator(){
              function recur(parentNode){
                if (!parentNode){
                  return false;
                }
                if (parentNode.type === "call" && isAggregator(parentNode.name)){
                  return false;
                }
                if (parentNode.type === "identifier") {
                  return true;
                }
                if (recur(parentNode.left)){
                  return true;
                }
                return recur(parentNode.right);
              }

              parsedTokens.forEach(function(node) {
                if(recur(node)){
                  return true;
                }
              });
              return false;
            }

            function parseNode(node, doc){
              switch (node.type) {
                case "boolean":
                  return node.value;
                  break;

                case "number":
                  return node.value;
                  break;

                case "call":
                  if (functions[node.name]){
                    var tempArgs= [];
                    for (var i = 0; i < node.args.length; i++){
                      tempArgs.push(parseNode(node.args[i], doc));
                    }
                    tempArgs.push(node.args[0].value);
                    return functions[node.name].apply(null, tempArgs);
                  }
                  throw "Unrecognized function: " + node.name;
                  break;

                case "identifier":
                  //if (typeof doc[node.value] === "undefined"){
                    //throw node.value + " is undefined in doc " + doc._id;
                    //}
                    //TODO: is this the correct behavior?
                    return doc[node.value];
                    break;

                  default:
                    if (operators[node.type]) {
                      if(node.left){
                        return operators[node.type](parseNode(node.left, doc), parseNode(node.right, doc));
                      }
                      return operators[node.type](parseNode(node.right, doc));
                    }
                    throw "Unknown token type";
                    break;
              }
            }

            function normalSelect(doc){

              parsedTokens.forEach(function(statement, i){
                if(statement.type === "identifier"){
                  viewRow[statement.value]= parseNode(statement, doc);
                } else {
                  viewRow[i]= parseNode(statement, doc);
                }
              });

              if(Object.keys(viewRow).length != 0){
                results.push(viewRow);
              }
            }

            var selectWithAggregator= function(){

              if(containsIdentifierWithoutAggregator()){
                throw "If an aggregation function is used in the select clause, all identifiers " +
                  "in the select clause must be wrapped by an aggregation function or appear in the " +
                  "group-by clause."
              }

              var aggregators= containsAggregator();

              aggregators.forEach(function(statement, i){

                if (!tracking[statement.name]){
                  tracking[statement.name]= {};
                }

                switch (statement.name) {

                  case "average":
                    tracking[statement.name][statement.args[0].value]= function(){
                      var count= 0;
                      var runningTotal= 0;
                      return function(val){
                        runningTotal += val;
                        count++;
                        return runningTotal/count;
                      };
                    }();
                    break;

                  case "max":
                    tracking[statement.name][statement.args[0].value]= function(){
                      var max;
                      return function(val){
                        if (!max || val > max){
                          max= val;
                        }
                        return max;
                      };
                    }();
                    break;

                  case "min":
                    tracking[statement.name][statement.args[0].value]= function(){
                      var min;
                      return function(val){
                        if (!min || val < min){
                          min= val;
                        }
                        return min;
                      };
                    }();
                    break;

                  case "count":
                    tracking[statement.name][statement.args[0].value]= function(){
                      var count= 0;
                      return function(val){
                        if (val !== null && val !== undefined){
                          count++;
                        }
                        return count;
                      };
                    }();
                    break;

                  case "sum":
                    tracking[statement.name][statement.args[0].value]= function(){
                      var runningTotal= 0;
                      return function(val){
                        runningTotal += val;
                        return runningTotal;
                      };
                    }();
                    break;
                }
                //if(statement.type === "identifier"){
                  //viewRow[statement.value]= parseNode(statement, doc);
                //} else {
                  //viewRow[i]= parseNode(statement, doc);
                //}
              });

              var selectFunction= function(doc){
                parsedTokens.forEach(function(statement, i){
                  if(statement.type === "identifier"){
                    viewRow[statement.value]= parseNode(statement, doc);
                  } else if (statement.type === "call" && isAggregator(statement.name)) {
                    viewRow[statement.args[0].value]= parseNode(statement, doc);
                  } else {
                    viewRow[i]= parseNode(statement, doc);
                  }
                });

                if(Object.keys(viewRow).length != 0){
                  results= [];
                  results.push(viewRow);
                }
              }
              return selectFunction;
            };

            if(containsAggregator()){
              return selectWithAggregator();
            } else {
              return normalSelect;
            }
          }();

          return interpreter;
    }();

    var whereFun= function() {

      if (!query.where) {
        return function(){return true;};
      }

      var parsedTokens= parse(query.where);

      var interpreter= function(doc){

        var operators = {
          "+": function(a, b) { return a + b; },
          "-": function(a, b) {
            if (typeof b === "undefined") return -a;
            return a - b;
          },
          "*": function(a, b) { return a * b; },
          "/": function(a, b) { return a / b; },
          "=": function(a, b) { return a === b; },
          "<": function(a, b) { return a < b; },
          "<=": function(a, b) { return a <= b; },
          ">": function(a, b) { return a > b; },
          ">=": function(a, b) { return a >= b; },
          "!=": function(a, b) { return a !== b; },
          "<>": function(a, b) { return a !== b; },
          "and": function(a, b) { return a && b; },
          "or": function(a, b) { return a || b; },
          "not": function(a) { return !a; }
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
              //if (typeof doc[node.value] === "undefined"){
                //throw node.value + " is undefined in doc " + doc._id;
                //}
                //TODO: is this the correct behavior?
                return doc[node.value];
                break;

              default:
                if (operators[node.type]) {
                  if(node.left){
                    return operators[node.type](parseNode(node.left), parseNode(node.right));
                  }
                  return operators[node.type](parseNode(node.right));
                }
                throw "Unknown token type";
                break;
          }
        }

        return parseNode(parsedTokens[0]);
      }

      return interpreter;
    }();

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
      console.log(results);
      return options.complete(null, {rows: results});
    };

    db.changes({
      conflicts: conflicts,
      include_docs: true,
      onChange: function(doc) {
        if (!('deleted' in doc)) {
          processDoc(doc.doc);
        }
      },
      complete: function() {
        checkComplete();
      }
    });
  }

  function query(fun, opts, callback) {

    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (callback) {
      opts.complete = callback;
    }

    if (typeof fun === 'object') {
      return viewQuery(fun, opts);
    }

    throw "Unrecognized query"
  }

  return {'gql': query};
};

// Deletion is a noop since we dont store the results of the view
GQL._delete = function() { };

Pouch.plugin('gql', GQL);
