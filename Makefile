YUI = ./lib/yuicompressor-2.4.7.jar

JS_TARGETS = \
    src/uuid.js \
    src/pouch.js

all :
	cat $(JS_TARGETS) > pouch.js

min : all
	java -jar $(YUI) pouch.js -o pouch.min.js