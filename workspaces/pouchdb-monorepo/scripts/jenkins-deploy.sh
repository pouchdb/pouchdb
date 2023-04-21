ROOT=$(pwd)

# Build the docs
cd $ROOT/docs
jekyll

# Publish docs
cp -R $ROOT/docs/_site/* /home/daleharvey/www/pouchdb.com

# Build
cd $ROOT
npm install

grunt
grunt spatial
grunt gql

cp $ROOT/dist/* /home/daleharvey/www/download.pouchdb.com