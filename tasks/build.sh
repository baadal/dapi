#!/bin/bash

rm -rf dist
webpack &
webpack --env ESM &
tsc --project tsconfig.types.json --emitDeclarationOnly --outDir dist/types &
wait
source tasks/fixup.sh

# Note: `npm pack` not executing properly when `prepublishOnly` script is used
# maybe because `npm pack` runs through a complete publish cycle, and it even
# runs the `publish` npm script and the associated pre- and post-scripts
#npm pack && mv *.tgz dist/
