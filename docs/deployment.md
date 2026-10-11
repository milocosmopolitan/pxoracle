# Manual S3 / CloudFront publishing

PXOracle remains a static Next.js export. `infra/template.json` is an AWS SAM template
(`AWS::Serverless-2016-10-31` transform) containing a private S3 bucket, CloudFront OAC,
a distribution, cache policy and viewer-request route function. There is no Lambda,
application server, paid interpretation API or browser AWS credential.

## Publish when wanted

Once this change is merged into `main`, open **Actions → Publish PXOracle → Run workflow**,
select **main**, then run it. Pushes and pull requests do **not** publish. The workflow
checks out the dispatch commit, rebuilds both WASM engines, runs the six AGENTS gates
plus deployment tests, uploads a build artifact, and deploys that exact artifact.
A non-main dispatch is skipped, and the AWS trust policy also rejects non-main tokens.
Concurrent publishes are serialized without interrupting an active deployment.

CLI equivalent:

```sh
gh workflow run publish.yml --repo milocosmopolitan/pxoracle --ref main
gh run list --workflow publish.yml --repo milocosmopolitan/pxoracle
```

The successful run summary contains the CloudFront HTTPS URL, current release ID and
previous release ID. The initial publish creates the website stack if absent; its
unpublished origin returns 404 until the first complete upload is selected.

## One-time account bootstrap

Region: **us-east-1**. Local credentials use **AWS_PROFILE=milo**. GitHub does not receive
that profile or long-lived access keys. `infra/bootstrap.json` creates two roles:

- `pxoracle-production-github-publish`: only this repository's `refs/heads/main` OIDC
  subject with `sts.amazonaws.com` audience. It can stage files in the one site bucket,
  operate the one site stack, pass the one CloudFormation role and invalidate CloudFront.
- `pxoracle-production-cloudformation`: trusted by CloudFormation, with S3 configuration
  permissions limited to the site bucket and the CloudFront resource lifecycle actions
  required by this template. CloudFront creation/lifecycle permissions use `Resource: *`
  because distribution/OAC/cache-policy IDs are allocated during stack creation. The
  publishing role cannot manage IAM or directly assume this service role. Treat changes
  to main's deployment templates as infrastructure-privileged code.

The account's existing GitHub OIDC provider is reused, never replaced. To reproduce the
bootstrap with SAM CLI, AWS CLI and authenticated `gh`:

```sh
AWS_PROFILE=milo AWS_REGION=us-east-1 bash scripts/bootstrap-publish.sh
```

The script deploys `pxoracle-publish-bootstrap` and sets these **repository variables**:
`AWS_REGION`, `AWS_ACCOUNT_ID`, `AWS_PUBLISH_ROLE_ARN`, `AWS_CLOUDFORMATION_ROLE_ARN`.
They are identifiers, not secrets. The website stack is `pxoracle-production`; its bucket
name is `pxoracle-production-<account>-us-east-1`. No custom domain, Route 53 record or ACM
certificate is required; the initial endpoint is the distribution's `cloudfront.net` name.

## Release and cache behavior

`python3 scripts/publish.py --release <unique-id>` performs the same publish operation
locally. It accepts `--stack`, `--out` and `--role`; standard AWS environment/profile
configuration applies. Build first with `npm ci`, an activated Emscripten 4.0.10 toolchain,
`npm run wasm`, `npm run build` and the required checks. A local invocation is explicit:

```sh
AWS_PROFILE=milo AWS_REGION=us-east-1 python3 scripts/publish.py \
  --release "$(git rev-parse HEAD)-$(date -u +%Y%m%d%H%M%S)"
```

1. Validate the export, both WASM headers/loaders, the current Worker and interpretation packs.
2. Upload hashed Next chunks to `shared/_next/static/` with one-year immutable caching.
3. Upload the full release to `releases/<id>/` with explicit WASM, module and HTML MIME.
   Browser-visible versionless paths revalidate. Write `release.json` last. Existing release
   IDs are refused; failed/partial uploads require a new ID. No upload uses `--delete`.
4. SAM updates CloudFront's origin path only after all upload commands succeed. Shared hashed
   chunks stay reachable by already-open tabs. CloudFormation retains the previous stack on
   failed updates; public smoke-check failure restores the previous content release, if any.
5. Wait for cache invalidation and check HTTPS routes, release identity, Worker/WASM MIME,
   interpretation JSON and genuine missing-file 404s. Failure remains a failed workflow.

The same distribution serves all paths and Workers. `/tarot` and `/tarot/` resolve to
`/tarot/index.html`; `.mjs`, `.wasm`, RSC `.txt` and images remain unchanged. Private S3 403/404
responses become **HTTP 404**, never an HTTP-200 app shell. S3 blocks all public access,
uses AES256 encryption and versioning, and grants object reads only to this distribution.
HTTP viewers redirect to HTTPS; origin requests are signed. SharedArrayBuffer/COOP/COEP
is unnecessary for the current single-threaded engines.

A release switch is not a global atomic cutover: edge propagation and already-loaded
Workers can overlap versions. Refresh an old tab after an incompatible engine/content
change. This design prevents pointing at a partially uploaded release, not arbitrary
cross-version session compatibility. Preserve the documented session/content contracts.

## Rollback and retention

Use the previous release ID from a successful run. Confirm its `release.json` exists in
S3, then update the same SAM stack with that `ReleaseId` and invalidate `/*`. Do not change
files inside an existing release prefix. Local administrator example:

```sh
AWS_PROFILE=milo AWS_REGION=us-east-1 sam deploy --template-file infra/template.json \
  --stack-name pxoracle-production --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides ReleaseId=PREVIOUS_RELEASE_ID
AWS_PROFILE=milo AWS_REGION=us-east-1 aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID --paths '/*'
```

Rollback restores content only, not arbitrary template changes. Keep the matching template
revision when reversing infrastructure changes. The S3 bucket is retained on stack deletion
and replacement. Old releases, old hashed chunks and noncurrent object versions are retained;
there is no automatic destructive cleanup. Storage/traffic charges are normal AWS usage.
The old `scripts/deploy-s3.sh` root uploader predates this release layout and must not be used
against this SAM-managed bucket.

## Validation

Run `sam validate --lint --template-file infra/template.json` and the same command for
`infra/bootstrap.json`; `python3 -m unittest discover -s tests/deployment -v`; and
`node --test tests/deployment.test.mjs`. CI runs these alongside the existing gates.
The failure tests cover incomplete/stale builds, failed staging without an origin switch,
permission errors, release reuse, public-check rollback and MIME/cache upload arguments.
These are orchestration tests, not a claim that a public production publish occurred.

References: [SAM deploy](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html),
[CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html),
[GitHub OIDC for AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).
