#!/bin/bash

if [[ -z $CLIENT ]]; then
  echo -e "\nUsing default client (android), you can specify with e.g."
  echo -e '$CLIENT'"=android" or '$CLIENT'"=ios\n"
  CLIENT=android
fi;

if [[ -z $DEVICE ]]; then
  ACTION=emulate
  echo -e "\nUsing default "'$DEVICE'"=false, you can also do:"
  echo -e '$DEVICE'"=true to run on a real device\n"
else
  if [[ $DEVICE -ne 'true' ]]; then
    ACTION=emulate
  else
    ACTION=run
  fi;
fi;

TESTS_DIR=./tests/integration/cordova

rm -fr $TESTS_DIR/www
mkdir -p $TESTS_DIR/www

mkdir -p $TESTS_DIR/www/node_modules
cp -r node_modules/mocha node_modules/chai node_modules/es5-shim \
    $TESTS_DIR/www/node_modules
mkdir -p $TESTS_DIR/www/tests/integration
cp -r tests/integration/*{js,html} tests/integration/deps $TESTS_DIR/www/tests/integration

mkdir -p $TESTS_DIR/www/dist
cp dist/pouchdb*js $TESTS_DIR/www/dist

./node_modules/replace/bin/replace.js '<body>' \
  '<body><script src="../../cordova.js"></script>' \
  $TESTS_DIR/www/tests/integration/index.html

if [[ ! -z $GREP ]]; then
  ./node_modules/replace/bin/replace.js '<body>' \
    "<body><script>window.GREP = ""'"$GREP"'"";</script>" \
    $TESTS_DIR/www/tests/integration/index.html
fi

if [[ ! -z $ES5_SHIMS ]]; then
  ES5_SHIM=$ES5_SHIMS # synonym
fi

if [[ ! -z $ES5_SHIM ]]; then
  ./node_modules/replace/bin/replace.js '<body>' \
    "<body><script>window.ES5_SHIM = ""'"$ES5_SHIM"'"";</script>" \
    $TESTS_DIR/www/tests/integration/index.html
fi

if [[ ! -z $COUCH_HOST ]]; then
  ./node_modules/replace/bin/replace.js '<body>' \
    "<body><script>window.COUCH_HOST = ""'"$COUCH_HOST"'"";</script>" \
    $TESTS_DIR/www/tests/integration/index.html
fi

if [[ ! -z $ADAPTER ]]; then
  ADAPTERS=$ADAPTER # I know I'm gonna mistype this
fi

if [[ ! -z $ADAPTERS ]]; then
 ./node_modules/replace/bin/replace.js '<body>' \
 "<body><script>window.ADAPTERS = ""'"$ADAPTERS"'"";</script>" \
 $TESTS_DIR/www/tests/integration/index.html
fi

if [[ ! -z $WEINRE_HOST ]]; then
  ./node_modules/replace/bin/replace.js '<body>' \
    "<body><script src=""'"$WEINRE_HOST"/target/target-script-min.js#anonymous""'""></script>" \
    $TESTS_DIR/www/tests/integration/index.html

fi

cd $TESTS_DIR

CORDOVA=../../../node_modules/cordova/bin/cordova

$CORDOVA platform add $CLIENT
if [[ $($CORDOVA plugin list | grep sqlite) ]]; then 
  $CORDOVA plugin rm io.litehelpers.cordova.sqlite
fi
if [[ $SQLITE_PLUGIN == 'true' ]]; then 
  $CORDOVA plugin add https://github.com/litehelpers/Cordova-sqlite-storage.git
fi
$CORDOVA $ACTION $CLIENT
