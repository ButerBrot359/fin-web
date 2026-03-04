#!/bin/sh

node form-configs-server/dist/index.js &
npx vite preview --host 0.0.0.0
