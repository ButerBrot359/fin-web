#!/bin/bash

trap 'kill 0' EXIT

echo "Starting backend mock server..."
(cd form-configs-server && npm run start) &

echo "Starting frontend dev server..."
npm run dev &

wait
