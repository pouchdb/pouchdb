function lex(where){
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

          if (!where) {
            return selectFun;
          }

          //always ending with a space to simplify lexer parsing
          where += " ";

          function advance (){
            if(index < where.length) {
              c = where[index++];
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
            //if (index + 1 < where.length && isOperator(where[index+1])){
            addToken(c + where[index+1]);
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
                  if (/>=/.test(where[index+1]))
                    pairedOperator();
                  else
                    addToken(c);
                  break;

                case ">":
                  if (where[index+1] === "=")
                    pairedOperator();
                  else
                    addToken(c);
                  break;

                case "!":
                  if (where[index+1] === "=")
                    pairedOperator();
                  else
                    throw new LexerError("'!' not followed by '='");

                default:
                  addToken(c);
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
        }

exports.lex= lex;
