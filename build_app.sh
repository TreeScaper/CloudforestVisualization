#!/bin/bash

mkdir cloudforest

rm -rf cloudforest/config
rm -rf cloudforest/templates
rm -rf cloudforest/static

mkdir cloudforest/config
mkdir cloudforest/templates
mkdir cloudforest/static

version_entry=$(head -n 3 package.json | tail -n 1 | grep '"version"')
if [[ ! -z "$version_entry" ]]; then
    visualization_version=$(echo "$version_entry" | awk '{print $2}' | sed 's/[",]//g')
else
    echo "Error determining version number."
    exit 1
fi

cat cloudforest.mako | sed "s/\@VISUALIZATION_VERSION_REPLACE\@/$visualization_version/" > cloudforest/templates/cloudforest.mako
cp cloudforest.xml cloudforest/config
cp "./dist/bundle-$visualization_version.js" cloudforest/static

tar -czvf cloudforest.tar.gz cloudforest/
