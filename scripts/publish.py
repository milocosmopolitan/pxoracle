#!/usr/bin/env python3
"""Stage a complete static release, then switch the SAM stack's CloudFront origin."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(*args):
    result = subprocess.run(args, check=True, text=True, capture_output=True)
    return result.stdout


def aws(*args):
    return run("aws", *args)


def validate_export(out):
    for name in ["index.html", "404.html", "tarot/index.html", "astrology/index.html",
                 "content/reading/semantics.1.json", "content/reading/rules.1.json",
                 "content/reading/reading.en.1.json"]:
        if not (out / name).is_file():
            raise ValueError(f"Incomplete static export: {name}")
    for feature in ["tarot", "astrology"]:
        directory = out / "engines" / feature
        if (directory / "engine.wasm").read_bytes()[:4] != b"\0asm":
            raise ValueError(f"Invalid {feature} WASM")
        if not (directory / "engine.mjs").is_file():
            raise ValueError(f"Missing {feature} WASM loader")
        if (directory / "worker.mjs").read_bytes() != (ROOT / "scripts/worker.mjs").read_bytes():
            raise ValueError("Stale Worker: run npm run wasm before npm run build")
    if not list((out / "_next/static").rglob("*.js")):
        raise ValueError("Missing Next static chunks")


def describe(stack):
    try:
        return json.loads(aws("cloudformation", "describe-stacks", "--stack-name", stack))["Stacks"][0]
    except subprocess.CalledProcessError as error:
        # Do not mistake credential/permission/network failures for an absent stack.
        if "does not exist" in error.stderr and "ValidationError" in error.stderr:
            return None
        raise


def output_values(stack):
    return {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}


def deploy(stack, release, role):
    args = ["sam", "deploy", "--template-file", str(ROOT / "infra/template.json"),
            "--stack-name", stack, "--region", os.environ.get("AWS_REGION", "us-east-1"),
            "--no-confirm-changeset", "--no-fail-on-empty-changeset", "--no-progressbar",
            "--parameter-overrides", f"ReleaseId={release}", "--tags", "Project=pxoracle"]
    if role:
        args += ["--role-arn", role]
    # Stream CloudFormation events, but never arbitrary app/session data.
    subprocess.run(args, check=True)


def upload(out, bucket, release):
    destination = f"s3://{bucket}/releases/{release}/"
    if json.loads(aws("s3api", "list-objects-v2", "--bucket", bucket,
                      "--prefix", f"releases/{release}/", "--max-keys", "1")).get("KeyCount", 0):
        raise ValueError("Release ID already exists; use a fresh ID (including run attempt)")
    # Shared hashed chunks survive a release switch for already-open tabs.
    aws("s3", "sync", str(out / "_next/static") + "/", f"s3://{bucket}/shared/_next/static/",
        "--cache-control", "public,max-age=31536000,immutable", "--only-show-errors")
    aws("s3", "sync", str(out) + "/", destination, "--exclude", "_next/static/*",
        "--exclude", "*.wasm", "--exclude", "*.mjs", "--exclude", "*.html",
        "--cache-control", "public,max-age=0,must-revalidate", "--only-show-errors")
    for extension, mime in [("wasm", "application/wasm"), ("mjs", "text/javascript"),
                            ("html", "text/html; charset=utf-8")]:
        aws("s3", "sync", str(out) + "/", destination, "--exclude", "*",
            "--include", "*." + extension, "--content-type", mime,
            "--cache-control", "no-cache", "--only-show-errors")
    # Written last: this release is complete enough to select as an origin.
    with tempfile.TemporaryDirectory() as temporary:
        marker = Path(temporary) / "release.json"
        marker.write_text(json.dumps({"release": release}))
        aws("s3", "cp", str(marker), destination + "release.json", "--content-type", "application/json",
            "--cache-control", "no-cache", "--only-show-errors")


def invalidate(distribution):
    result = json.loads(aws("cloudfront", "create-invalidation", "--distribution-id", distribution,
                            "--paths", "/*"))
    aws("cloudfront", "wait", "invalidation-completed", "--distribution-id", distribution,
        "--id", result["Invalidation"]["Id"])


def publish(stack, release, out, role):
    if not re.fullmatch(r"pxoracle-[a-z0-9-]{1,24}", stack):
        raise ValueError("Use a pxoracle-* stack name (maximum 33 characters)")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,79}", release) or release == "unpublished":
        raise ValueError("Use a new release ID with only letters, digits and hyphens")
    validate_export(out)
    state = describe(stack)
    if state is None:
        deploy(stack, "unpublished", role)
        state = describe(stack)
    if state["StackStatus"] not in ["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"]:
        raise ValueError("Stack is not ready: " + state["StackStatus"])
    previous = output_values(state)
    upload(out, previous["SiteBucketName"], release)
    # A failed upload never reaches this switch; CloudFormation handles failed updates.
    deploy(stack, release, role)
    current = output_values(describe(stack))
    try:
        invalidate(current["DistributionId"])
        run(sys.executable, str(ROOT / "scripts/check-published.py"), current["SiteUrl"], release)
    except subprocess.CalledProcessError:
        if previous["ReleaseId"] != "unpublished":
            print("Public checks failed; restoring previous content release", file=sys.stderr)
            deploy(stack, previous["ReleaseId"], role)
            invalidate(previous["DistributionId"])
        raise
    print(json.dumps(current, indent=2))
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as file:
            file.write(f"### Published PXOracle\n\n[{current['SiteUrl']}]({current['SiteUrl']})\n\n"
                       f"Release: `{release}`\n\nPrevious: `{previous['ReleaseId']}`\n")
    return current


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--stack", default="pxoracle-production")
    parser.add_argument("--release", required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "apps/web/out")
    parser.add_argument("--role", default=os.environ.get("AWS_CLOUDFORMATION_ROLE_ARN", ""))
    args = parser.parse_args()
    os.environ.setdefault("AWS_REGION", "us-east-1")
    os.environ.setdefault("AWS_DEFAULT_REGION", os.environ["AWS_REGION"])
    os.environ.setdefault("AWS_PAGER", "")
    try:
        publish(args.stack, args.release, args.out, args.role)
    except subprocess.CalledProcessError as error:
        if error.stderr:
            print(error.stderr, file=sys.stderr)
        raise
