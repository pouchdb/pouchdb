#!/bin/bash

set -e

publish_packages () {
  local root_dir="$PWD"
  local todo="$root_dir/release-todo.txt"

  if [[ ! -e "$todo" ]] ; then
    echo 'No packages to release, quitting.'
    return 0
  fi

  local pkgs=($(cat "$todo"))
  local failed='n'

  for pkg in "${pkgs[@]}" ; do
    cd "$root_dir"

    if ! should_publish "$pkg" ; then
      continue
    fi

    if [[ "$failed" == 'n' ]] ; then
      if ! publish_package "$pkg" ; then
        failed='y'
        echo "Publishing '$pkg' failed, quitting."
        echo "$pkg" > "$todo"
      fi
    else
      echo "$pkg" >> "$todo"
    fi
  done

  if [[ "$failed" == 'n' ]] ; then
    rm "$todo"
    return 0
  else
    return 1
  fi
}

should_publish () {
  local pkg="$1"

  if [ ! -d "packages/node_modules/$pkg" ]; then
    return 1
  elif [ "true" = $(node --eval "console.log(require('./packages/node_modules/$pkg/package.json').private);") ]; then
    return 1
  else
    return 0
  fi
}

publish_package () {
  local pkg="$1"

  cd "packages/node_modules/$pkg"
  echo "Publishing $pkg..."

  if [ -n "$DRY_RUN" ]; then
    echo "Dry run, not publishing"
  elif [ -n "$BETA" ]; then
    if ! npm publish --tag beta ; then
      return 1
    fi
  else
    if ! npm publish ; then
      return 1
    fi
  fi
}

publish_packages
