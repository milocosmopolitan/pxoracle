#!/usr/bin/env bash
set -euo pipefail
: "${PXORACLE_BUCKET:?Set the destination S3 bucket name}"
: "${PXORACLE_DISTRIBUTION:?Set the CloudFront distribution ID}"
cd "$(dirname "$0")/.."
test -f apps/web/out/astrology/index.html
test -f apps/web/out/engines/astrology/engine.wasm
# No --delete: preserve old hashed chunks until existing browser sessions expire.
aws s3 sync apps/web/out/ "s3://$PXORACLE_BUCKET/" --exclude '*' --include '_next/static/*' --cache-control 'public,max-age=31536000,immutable'
aws s3 sync apps/web/out/ "s3://$PXORACLE_BUCKET/" --exclude '_next/static/*' --exclude '*.wasm' --exclude '*.html' --exclude '*.mjs' --cache-control 'public,max-age=0,must-revalidate'
aws s3 sync apps/web/out/ "s3://$PXORACLE_BUCKET/" --exclude '*' --include '*.wasm' --content-type application/wasm --cache-control 'public,max-age=0,must-revalidate'
aws s3 sync apps/web/out/ "s3://$PXORACLE_BUCKET/" --exclude '*' --include '*.mjs' --content-type text/javascript --cache-control 'public,max-age=0,must-revalidate'
# Upload HTML last. A deployment still needs a coordinated asset versioning strategy for zero-downtime updates.
aws s3 sync apps/web/out/ "s3://$PXORACLE_BUCKET/" --exclude '*' --include '*.html' --content-type 'text/html; charset=utf-8' --cache-control 'no-cache'
aws cloudfront create-invalidation --distribution-id "$PXORACLE_DISTRIBUTION" --paths '/*'
