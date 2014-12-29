#!/usr/bin/env bash

# TODO: once chromedriver 2.13 is bundled with appium,
# we can get rid of this

CHROMEDRIVER_VERSION=$(node_modules/appium//build/chromedriver/mac/chromedriver -v | python -c "import re, sys; print re.findall('2\.(\d+)', sys.stdin.read())[0]")
if [[ $CHROMEDRIVER_VERSION == '13' ]]; then
  echo "chromedriver version is 2.$CHROMEDRIVER_VERSION"
  exit 0; # done
fi

curl -O http://chromedriver.storage.googleapis.com/2.13/chromedriver_mac32.zip

# validate checksum, because I'm paranoid
CHECKSUM=$(md5 chromedriver_mac32.zip | grep e37a65a1be68523385761d29decf15d4)

if [[ -z $CHECKSUM ]]; then
  rm -f rm chromedriver_mac32.zip
  echo "downloaded chromedriver_mac32.zip doesn't match expected checksum e37a65a1be68523385761d29decf15d4"
  exit 1
fi
  

unzip chromedriver_mac32.zip
rm -f chromedriver_mac32.zip
mv -f chromedriver node_modules/appium//build/chromedriver/mac/chromedriver

echo "chromedriver updated to 2.13"
