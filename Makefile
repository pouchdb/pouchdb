YUI = ./lib/yuicompressor-2.4.7.jar

RELEASE = alpha

JS_TARGETS = \
	src/pouch.js \
	src/pouch.collate.js \
	src/pouch.merge.js \
	src/pouch.replicate.js \
	src/pouch.utils.js \
	src/adapters/pouch.http.js \
	src/adapters/pouch.idb.js

AMD_JS_TARGETS = \
	src/pouch.amd.js

EXTRA_JS_TARGETS = \
	src/deps/jquery-1.7.1.min.js \
	src/deps/uuid.js

all :
	(echo "(function() { "; cat $(EXTRA_JS_TARGETS); cat $(JS_TARGETS); echo " })(this);") > pouch.$(RELEASE).js

amd :
	(echo "define('pouchdb',['jquery', 'simple-uuid', 'md5'], function(jquery, uuid, md5) { "; cat $(AMD_JS_TARGETS); cat $(JS_TARGETS); echo " return Pouch })") > pouch.amd.$(RELEASE).js

min : all
	java -jar $(YUI) pouch.$(RELEASE).js -o pouch.$(RELEASE).min.js