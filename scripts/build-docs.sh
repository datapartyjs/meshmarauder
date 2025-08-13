#!/usr/bin/env bash

set -x

rm -rf docs
mkdir docs
npm run generate-docs
mv docs/meshmarauder/1.0.0/* docs/
#cp -r images/ docs
