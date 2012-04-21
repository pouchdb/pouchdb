YUI = ./lib/yuicompressor-2.4.7.jar

RELEASE = alpha

JS_TARGETS = \
    src/deps/jquery-1.7.1.min.js \
    src/deps/uuid.js \
    src/pouch.js \
    src/pouch.collate.js \
    src/pouch.merge.js \
    src/pouch.replicate.js \
    src/pouch.utils.js \
    src/adapters/pouch.http.js \
    src/adapters/pouch.idb.js

all :
	(echo "(function() { "; cat $(JS_TARGETS); echo " })(this);") > pouch.$(RELEASE).js

min : all
	java -jar $(YUI) pouch.$(RELEASE).js -o pouch.$(RELEASE).min.js