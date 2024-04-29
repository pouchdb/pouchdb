#!/usr/bin/env -S bash -eu

# Download a pouchdb production build for testing inter-version migrations in
# tests/integration/browser.migration.js

log() {
  echo "[get-postfixed-pouchdb-build] $*"
}

indexeddb_support() {
  # indexeddb adapter introduced in v7.2.1
  # see: https://pouchdb.com/2020/02/12/pouchdb-7.2.0.html
  lesser="$(sort -V <(echo "$1") <(echo 7.2.1) | head -n1)"
  [[ "$lesser" = "7.2.1" ]]
}

# Recently, postfixed JS files have been added in minified form.
infix=".min"
while [[ $# -gt 1 ]]; do
  if [[ $1 = --no-minify ]]; then
    infix=""
  else
    echo "!!! Unrecognised arg: $1"
    exit 1
  fi
  shift
done

if [[ $# -lt 1 ]]; then
  echo "!!! Missing required argument: pouch db version"
  exit 1
fi

version="$1"
target="./pouchdb-$version-postfixed.js"
nodots="$(tr -d . <<<"$version")"
tmp="$(mktemp)"

log "Fetching minified pouch build..."
wget "https://github.com/pouchdb/pouchdb/releases/download/$version/pouchdb-${version}${infix}.js" --output-document="$tmp"

log "Converting globals..."
sed "s/PouchDB/PouchDBVersion$nodots/g" "$tmp" > "$target"

log "Checking for indexeddb support..."
if indexeddb_support "$version"; then
  log "  indexeddb supported!"

  tmp="$(mktemp)"
  target="./pouchdb-$version-indexeddb-postfixed.js"

  log "  Fetching indexeddb adapter..."
  wget "https://github.com/pouchdb/pouchdb/releases/download/$version/pouchdb.indexeddb.min.js" --output-document="$tmp"

  log "  Converting globals..."
  sed "s/PouchDB/PouchDBVersion$nodots/g" "$tmp" > "$target"
else
  echo "  indexeddb not supported by PouchDB v$version"
fi

log "Completed OK."
