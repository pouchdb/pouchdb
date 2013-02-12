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

    var results = [];

    function isAggregator(str){return /max|average|min|sum|count/.test(str);}

    function getIdentifierList(str){
      var columns;
      if (!str){
        return [];
      }
      if (str.indexOf(",") === -1){
        columns= [str.trim()];
      } else {
        columns= str.trim().split(/\s*,\s*/);
      }
      return columns.map(function (id){return id.replace(/`([^`]*)`/, "$1");});
    }

    function parse(queryString){

      var lexedTokens= function(){
        var tokens = [], c, index = 0, currentString= "";

        function isOperator(c) { return /[=<>!+\-*\/(),]/.test(c); }
        function isFullWordOperator(str) { return /^and$|^or$|^not$|^is$/.test(str);}
        function isBooleanLiteral(str) { return /true|false/.test(str);}
        function isDigit(c) { return /[0-9.]/.test(c); }
        function isWhiteSpace(c) { return /\s/.test(c); }
        function isConstant(str) {return /null/.test(str);}
        function isString(str) {return /^".*"$|^'.*'$/.test(str);}

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
          var normalizedString= currentString.toLowerCase();
          if (normalizedString !== ""){
            //full-word operators, e.g. not, where
            if (isFullWordOperator(normalizedString)){
              addToken(normalizedString);
              //boolean literal
            } else if (isBooleanLiteral(normalizedString)) {
              addToken("boolean", normalizedString === "true");
              //number literal
            } else if (isDigit(normalizedString[0])) {
              addToken("number", parseFloat(normalizedString));
            } else if (isConstant(normalizedString)){
              addToken("constant", normalizedString);
              //note that string literals are cast sensitive
            } else if (isString(currentString)) {
              addToken("string", currentString);
            } else {
              addToken("identifier", normalizedString);
            }
          }
        }

        function pairedOperator(){
          addToken(c + queryString[index]);
          advance();
        }

        function quotedString(delimiter, label){
          while (advance()) {
            if (c !== delimiter){
              currentString += c;
            } else {
              addToken(label, currentString);
              return;
            }
          }
          throw new LexerError(label + " needs a closing " + delimiter);
        }

        while (advance()) {
          //back quoted identifiers
          if (c === "`"){
            quotedString("`", "identifier");
          //string literals with single quotes
          } else if (c === "'") {
            quotedString("'", "string");
          //string literals with double quotes
          } else if (c === '"') {
            quotedString('"', "string");
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

      function isFunction(name){ return isAggregator(name) || /lower|upper/.test(name.toLowerCase()); }

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
      prefix("not", 70);

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
      symbol("constant", function(c) {
        return c;
      });
      symbol("string", function(str) {
        return str;
      });

      symbol(",", function() {
        //commas are used to separate independent statements
        return expression(20);
      });

      symbol("is", null, 40, function (left) {
        var type= "is";
        //"is not" is a special case
        if (peekToken().type === "not"){
          type= "!=";
          advance();
        }
        return {
          type: type,
          left: left,
          right: expression(40)
        };
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

      console.log(parseTree);
      return parseTree;
    }

    var selectFun= function(){

      //handle special "select all" case
      if(!query.select || query.select.trim() === "*"){
        if (query.pivot || query.groupBy){
          throw "If a pivot or group by is present, select columns must be specified explicitly.";
        } else {
          return function(doc){return doc;};
        }
      }

      var parsedTokens= parse(query.select);

      return function(){

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
          max: function(values, label) {
            return values.reduce(function(max, a) {
              if(a[label] && (!max || a[label] > max)){max= a[label];} 
              return max;
            }, null) },
            min: function(values, label) {
              return values.reduce(function(min, a) {
                if(a[label] && (!min || a[label] < min)){min= a[label];} 
                return min;
              }, null) },
              average: function(values, label) {
                var v= values.reduce(function(tracker, a) {
                  if(a[label]){
                    if(typeof a[label] !== "number"){
                      throw "All values being averaged must be numbers, but "+ a[label] + " is not.";
                    }
                    return {count: ++tracker.count, total: tracker.total+a[label]}; 
                  }
                return tracker }, {count: 0, total: 0});
                return v.total/v.count;
              },
              count: function(values, label) {
                return values.reduce(function(count, a) {
                  if(a[label]){
                    return ++count;
                  }
                  return count;
                }, 0);
              },
              sum: function(values, label) {
                return values.reduce(function(sum, a) { 
                  if(a[label]){
                    if(typeof a[label] !== "number"){
                      throw "All values being summed must be numbers, but "+ a[label] + " is not.";
                    }
                    return sum+a[label];
                  }
                return sum}, 0)}
        };


        function containsAggregator(){
          function recur(parentNode){
            if (!parentNode){
              return false;
            }
            if (parentNode.type === "call" && isAggregator(parentNode.name)){
              return true;
            }
            if (recur(parentNode.left)){
              return true;
            }
            return recur(parentNode.right);
          }

          var hasAggregator= false;

          for (var i=0; i< parsedTokens.length; i++){
            if(recur(parsedTokens[i])){
              hasAggregator= true;
              break;
            }
          };

          return hasAggregator;
        }

        function containsIdentifierWithoutAggregator(){
          function recur(parentNode){
            if (!parentNode){
              return false;
            }
            if (parentNode.type === "call" && isAggregator(parentNode.name)){
              return false;
            }
            //unaggregated identifiers are allowed if they are in the groupBy clause
            if (parentNode.type === "identifier"){
              var re= new RegExp("\b"+parentNode.value+"\b");
              if(query.groupBy && !re.test(query.groupBy)){
                return false;
              }
              return true;
            }
            if (recur(parentNode.left)){
              return true;
            }
            return recur(parentNode.right);
          }

          var contains= false;

          for (var i=0; i< parsedTokens.length; i++){
            if(recur(parsedTokens[i])){
              contains= true;
              break;
            }
          }
          return contains;
        }

        function pivotOverlap(pivotingColumns){
          var overlap= false;
          var groupByColumns= getIdentifierList(query.groupBy);
          var selectColumns= [];

          function recur(parentNode){
            if (!parentNode){
              return;
            }
            if (parentNode.type === "identifier"){
              selectColumns.push(parentNode.value);
              return;
            }
            recur(parentNode.left);
            recur(parentNode.right);
          }

          parsedTokens.forEach(function(node){
              recur(node); 
          });

          for (var i=0; i< pivotingColumns.length; i++){
            if (groupByColumns.indexOf(pivotingColumns[i]) !== -1
            || selectColumns.indexOf(pivotingColumns[i]) !== -1){
              overlap= true;
              break;
            }
          }

          return overlap;
        }

        function parseNode(node, doc){
          switch (node.type) {
            case "boolean":
              return node.value;
              break;

            case "number":
              return node.value;
              break;

            case "string":
              return node.value;
              break;

            case "call":
              if (functions[node.name]){
                var tempArgs= [];
                if (isAggregator(node.name)){
                  return functions[node.name].apply(null, [doc, node.args[0].value]);
                }
                for (var i = 0; i < node.args.length; i++){
                  tempArgs.push(parseNode(node.args[i], doc));
                }
                return functions[node.name].apply(null, tempArgs);
              }
              throw "Unrecognized function: " + node.name;
              break;

            case "identifier":
              //handle the case where a column in the group-by is present in the 
              //select without and aggregate function (all cells will have the same value)
              if (Array.isArray(doc)){
                if(doc[0][node.value] === undefined){
                  return null;
                }
                return doc[0][node.value];
              }
              if (doc[node.value] === undefined){
                return null;
              }
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

        return function (){
          //reduce special case checking
          if (!query.pivot){
            query.pivot= "";
          }

          if (!containsAggregator() && !query.pivot){
            return function(values){
              var viewRow= {};
              var result= [];
              values.forEach(function(doc){
                parsedTokens.forEach(function(statement, i){
                  if(statement.type === "identifier"){
                    viewRow[statement.value]= parseNode(statement, doc);
                  } else {
                    viewRow[i]= parseNode(statement, doc);
                  }
                });
                if(Object.keys(viewRow).length != 0){
                  result.push(viewRow);
                }
              });

              return result;
            }
          } else {
            //select in the presence of aggregators and/or pivot
            if(containsIdentifierWithoutAggregator()){
              throw "If an aggregation function is used in the select clause, all identifiers " +
                "in the select clause must be wrapped by an aggregation function or appear in the " +
                "group-by clause."
            }
            if (query.pivot){
            //if there are pivoting columns
              var pivotingColumns= getIdentifierList(query.pivot);
              if(pivotOverlap(pivotingColumns)){
                throw "Columns that appear in the pivot clause may not appear in the group by or " +
                  "select clauses.";
              }
              return function(values){
                var viewRow= {};
                var pivotGroups= {};
                values.forEach(function (doc){
                  var pivotKey= pivotingColumns.map(function(id){return doc[id];}).join(", ");
                  if (!pivotGroups[pivotKey]){
                    pivotGroups[pivotKey]= [doc];
                  } else {
                    pivotGroups[pivotKey].push(doc);
                  }
                });
                for (var pg in pivotGroups){
                  parsedTokens.forEach(function(statement, i){
                    if(statement.type === "identifier"){
                      viewRow[statement.value]= parseNode(statement, pivotGroups[pg]);
                    } else if (statement.type === "call" && isAggregator(statement.name)) {
                      viewRow[pg + " " + statement.name+"-"+statement.args[0].value]= 
                      parseNode(statement, pivotGroups[pg]);
                    }
                  });
                }
                if(Object.keys(viewRow).length != 0){
                  return [viewRow];
                }

              }
            } else {
              return function(values){
                var viewRow= {};
                parsedTokens.forEach(function(statement, i){
                  if(statement.type === "identifier"){
                    viewRow[statement.value]= parseNode(statement, values);
                  } else if (statement.type === "call" && isAggregator(statement.name)) {
                    viewRow[statement.name+"-"+statement.args[0].value]= parseNode(statement, values);
                  } else {
                    viewRow[i]= parseNode(statement, values);
                  }
                });

                if(Object.keys(viewRow).length != 0){
                  return [viewRow];
                }

              }
            }
            return selectFunction;
          }
        }();
      }();
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
          "is": function(a, b) { return a === b; },
          "<": function(a, b) { return a < b; },
          "<=": function(a, b) { return a <= b; },
          ">": function(a, b) { 
          return a > b; },
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

            case "constant":
              if (node.value === "null"){
                return null;
              }
              throw "Unknown constant: " + node.value;
              break;

            case "string":
              return node.value;
              break;

            case "identifier":
              if(doc[node.value] === undefined){
                return null;
              }
              return doc[node.value];
              break;

            default:
              if (operators[node.type]) {
                if(node.left){
                  var left= parseNode(node.left);
                  var right= parseNode(node.right);
                  return operators[node.type](left, right);
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

    var groupByFun= function(){
      if(!query.groupBy){
        return function(doc){return null;};
      }

      var columns= getIdentifierList(query.groupBy);

      var interpreter= function(doc){
        var key= [];
        columns.forEach(function(col){
          key.push(doc[col]);
        });
        return key;
      };

      return interpreter;
    }();

    function map(doc){
      if (whereFun(doc)){
        results.push({id: doc._id, key: groupByFun(doc), value: doc});
      }
    }

    function reduce(keys, values){
      return selectFun(values);
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

      var groups= [];
      results.forEach(function(e) {
        var last= groups[groups.length-1] || null;
        if (last && Pouch.collate(last.key[0][0], e.key) === 0) {
          last.key.push([e.key, e.id]);
          last.value.push(e.value);
          return;
        }
        groups.push({key: [[e.key, e.id]], value: [e.value]});
      });

      groups.forEach(function(e) {
        e.value= reduce(e.key, e.value) || null;
        e.key= e.key[0][0];
      });

      var flattenedOutput= [];

      //this bit is to make the output palatable
      groups.forEach(function(e){
        e.value.forEach(function(f){
          flattenedOutput.push(f);
        });
      });

      console.log(flattenedOutput);

      options.complete(null, {rows: flattenedOutput});
    };

    db.changes({
      conflicts: conflicts,
      include_docs: true,
      onChange: function(doc) {
        if (!('deleted' in doc)) {
          map(doc.doc);
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
