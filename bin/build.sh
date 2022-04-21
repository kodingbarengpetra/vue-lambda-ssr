#!/usr/bin/env bash
cd lambda/ssr
npm i
npm run build
cd ../../
cd web
npm i
npm run build
