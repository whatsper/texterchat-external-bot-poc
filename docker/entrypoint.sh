#!/bin/bash
set -o errexit

NODEPATH=$(which node)
$NODEPATH /app/build/index.js
