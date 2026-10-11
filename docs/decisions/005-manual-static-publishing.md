# ADR 005: Manual SAM static publishing

Accepted for the deployment configuration. Supersedes the earlier deployment notes that
excluded AWS account setup; all engine, privacy and static-export boundaries remain intact.

Use an explicitly dispatched GitHub workflow on main, not push-triggered production writes.
Build WASM and static output together to avoid stale ignored artifacts. Use GitHub OIDC and
a separately bootstrapped CloudFormation service role instead of permanent access keys.

A SAM template owns private encrypted/versioned S3, CloudFront OAC, HTTPS, cache and directory
routing. Complete releases are staged under unique prefixes; only then does the distribution
origin change. Hashed Next chunks have a shared retained origin so open tabs can still load
old chunks. Versionless assets revalidate. Genuine errors remain HTTP 404.

Direct root sync was simpler but could mix an old engine with new UI during upload. A server
or Lambda router was unnecessary for the existing static export. Full globally atomic client
version pinning is not claimed; already-open Workers require the existing compatibility
policy. Automatic pruning is deferred so rollback and active chunks are not deleted silently.

Validation covers template lint, trust restrictions, upload failure/order, stale Worker
rejection, MIME/routing and content rollback. The workflow checks the real public endpoint
after every explicit publish. See [deployment instructions](../deployment.md) for bootstrap,
manual execution, IAM scope, rollback and cost/retention limits.
