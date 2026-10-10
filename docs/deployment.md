# S3 + CloudFront static deployment

Build with `npm ci`, `npm run wasm`, `npm run build`. Upload the contents of `apps/web/out`, including `art`, `content`, `engines`, `_next`, route directories, and `404.html`.

Recommended origin: private S3 REST endpoint with CloudFront Origin Access Control. Set CloudFront default root to `index.html`. Associate `infra/cloudfront-function.js` with viewer-request: extensionless documents become `/path/index.html`; real JS/WASM/assets remain unchanged. Unknown paths must return a genuine 404 response using `404.html`, not an HTTP-200 application shell.

Use HTTPS, compression, correct MIME (`application/wasm`, `text/javascript` for `.mjs`, `text/html`, `image/webp`). Emscripten uses single-threaded Workers, so SharedArrayBuffer/COOP/COEP is not required. Preserve same-origin Worker/module fetches. No AWS keys belong in browser code.

`PXORACLE_BUCKET=... PXORACLE_DISTRIBUTION=... bash scripts/deploy-s3.sh` is an explicit opt-in publish operation using locally configured AWS credentials. Scope permissions to the destination bucket and distribution. It preserves old hashed Next assets for existing sessions. Versionless engine/art URLs revalidate; zero-downtime releases should stage versioned release paths before a later production rollout. Do not run the script against an unconfirmed bucket.

No AWS deployment has been run. Acceptance here is a real static export plus deployable files and documented routing/MIME/cache settings, not a claim of live infrastructure.
