#!/bin/sh
# Build the Chrome Web Store upload: doomwall-<version>.zip (gitignored).
cd "$(dirname "$0")" || exit 1
v=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
out="doomwall-$v.zip"; rm -f "$out"
zip -qr "$out" manifest.json assets src README.md WEBMCP.md -x '.DS_Store' && echo "$out ($(du -h "$out" | cut -f1))"
