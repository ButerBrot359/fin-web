#!/bin/sh

node mock-server/dist/index.js &
npx vite preview --host 0.0.0.0
