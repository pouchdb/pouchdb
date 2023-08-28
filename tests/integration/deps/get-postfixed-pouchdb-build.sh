#!/bin/bash -eu

# Download a pouchdb production build for testing inter-version migrations in
# tests/integration/browser.migration.js

log() {
  echo "[get-postfixed-pouchdb-build] $*"
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

version="$1"
target="./pouchdb-$version-postfixed.js"
nodots="$(tr -d . <<<"$version")"
tmp="$(mktemp)"

log "Fetching minified pouch build..."
wget "https://github.com/pouchdb/pouchdb/releases/download/$version/pouchdb-${version}${infix}.js" --output-document="$tmp"

log "Converting globals..."
sed "s/PouchDB/PouchDBVersion$nodots/g" "$tmp" > "$target"

log "Completed OK."
