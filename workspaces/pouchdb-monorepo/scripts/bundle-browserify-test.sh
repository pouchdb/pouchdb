#!/bin/bash

echo '<!DOCTYPE html><html>' > test.html
echo "<head><meta charset='utf-8'></head>" >> test.html
echo "<script type=\"text/javascript\">" >> test.html
browserify $1 >> test.html
echo "</script></html>" >> test.html