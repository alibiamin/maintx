#!/bin/sh
# Build du frontend en UTF-8 (évite Accdez au lieu de Accédez à sur la VM)
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
npm run build
