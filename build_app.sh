#!/bin/bash

mkdir cloudforest
mkdir cloudforest/config
mkdir cloudforest/templates
mkdir cloudforest/static

cp cloudforest.xml cloudforest/config
cp cloudforest.mako cloudforest/templates
cp ./dist/bundle.js cloudforest/static

tar -czvf cloudforest.tar.gz cloudforest/