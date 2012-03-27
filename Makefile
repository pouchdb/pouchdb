YUI = ./lib/yuicompressor-2.4.7.jar

RELEASE = alpha

JS_TARGETS = \
    src/jquery-1.7.1.min.js \
    src/uuid.js \
    src/pouch.js \
    src/pouch.merge.js

all :
	(echo "(function() { "; cat $(JS_TARGETS); echo " })(this);") > pouch.$(RELEASE).js

min : all
	java -jar $(YUI) pouch.$(RELEASE).js -o pouch.$(RELEASE).min.js