#!/bin/bash -eu

lockfile=package-lock.json

log() { echo "[verify-package-lock] $*"; }

log "Pruning dependencies..."
npm prune --fund=false --audit=false

log "Checking for changes to $lockfile..."
if [[ "$(git status --porcelain -- "$lockfile")" != "" ]]; then
	git --no-pager diff -- "$lockfile"
	log "!!!"
	log "!!! Unexpected changes to $lockfile found; see above"
	log "!!!"
  exit 1
fi

log "Dependencies verified OK."
