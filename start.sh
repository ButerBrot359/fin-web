#!/bin/sh

node form-configs-server/dist/index.js &
npx vite preview --config vite.preview.config.ts
