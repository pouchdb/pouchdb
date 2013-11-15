in progress browserify, build with 

```bash
browserify -o dist/pouchdb-browserify.js -e src/pouch.js -s Pouch -i ./adapters/pouch.leveldb
```