import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("publish", ROOT / "scripts/publish.py")
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


def state(release="old"):
    return {"StackStatus": "UPDATE_COMPLETE", "Outputs": [
        {"OutputKey": k, "OutputValue": v} for k, v in {
            "SiteBucketName": "test-bucket", "DistributionId": "EXAMPLE",
            "SiteUrl": "https://example.cloudfront.net", "ReleaseId": release}.items()]}


class PublishTests(unittest.TestCase):
    def test_upload_failure_never_switches_origin(self):
        with patch.object(publish, "validate_export"), patch.object(publish, "describe", return_value=state()), \
                patch.object(publish, "upload", side_effect=RuntimeError("upload failed")), \
                patch.object(publish, "deploy") as deploy:
            with self.assertRaises(RuntimeError):
                publish.publish("pxoracle-production", "new", Path("out"), "role")
            deploy.assert_not_called()

    def test_public_failure_restores_previous_origin(self):
        with patch.object(publish, "validate_export"), patch.object(publish, "describe", side_effect=[state(), state("new")]), \
                patch.object(publish, "upload"), patch.object(publish, "deploy") as deploy, \
                patch.object(publish, "invalidate") as invalidate, \
                patch.object(publish, "run", side_effect=subprocess.CalledProcessError(1, "smoke")):
            with self.assertRaises(subprocess.CalledProcessError):
                publish.publish("pxoracle-production", "new", Path("out"), "role")
            self.assertEqual([call.args[1] for call in deploy.call_args_list], ["new", "old"])
            self.assertEqual(invalidate.call_count, 2)

    def test_invalidation_failure_also_restores_previous_release(self):
        with patch.object(publish, "validate_export"), patch.object(publish, "describe", side_effect=[state(), state("new")]), \
                patch.object(publish, "upload"), patch.object(publish, "deploy") as deploy, \
                patch.object(publish, "invalidate", side_effect=[subprocess.CalledProcessError(1, "invalidate"), None]), \
                patch.object(publish, "run") as smoke:
            with self.assertRaises(subprocess.CalledProcessError):
                publish.publish("pxoracle-production", "new", Path("out"), "role")
            self.assertEqual([call.args[1] for call in deploy.call_args_list], ["new", "old"])
            smoke.assert_not_called()

    def test_success_orders_upload_switch_invalidation_and_smoke(self):
        order = []
        with patch.object(publish, "validate_export"), patch.object(publish, "describe", side_effect=[state(), state("new")]), \
                patch.object(publish, "upload", side_effect=lambda *a: order.append("upload")), \
                patch.object(publish, "deploy", side_effect=lambda *a: order.append("switch")), \
                patch.object(publish, "invalidate", side_effect=lambda *a: order.append("invalidate")), \
                patch.object(publish, "run", side_effect=lambda *a: order.append("smoke")), \
                patch.dict(publish.os.environ, {}, clear=True):
            publish.publish("pxoracle-production", "new", Path("out"), "role")
        self.assertEqual(order, ["upload", "switch", "invalidate", "smoke"])

    def test_permission_failure_is_not_misread_as_missing_stack(self):
        with patch.object(publish, "aws", side_effect=subprocess.CalledProcessError(1, "aws", stderr="AccessDenied")):
            with self.assertRaises(subprocess.CalledProcessError):
                publish.describe("pxoracle-production")
        with patch.object(publish, "aws", side_effect=subprocess.CalledProcessError(1, "aws", stderr="ValidationError: Stack does not exist")):
            self.assertIsNone(publish.describe("pxoracle-production"))

    def test_no_delete_upload_explicit_mime_and_marker_last(self):
        calls = []
        with patch.object(publish, "aws", side_effect=lambda *args: calls.append(args) or '{"KeyCount":0}'):
            publish.upload(Path("out"), "test-bucket", "new")
        self.assertTrue(all("--delete" not in c for c in calls))
        for mime in ["application/wasm", "text/javascript", "text/html; charset=utf-8"]:
            self.assertTrue(any(mime in c for c in calls))
        self.assertIn("s3://test-bucket/shared/_next/static/", calls[1])
        self.assertIn("s3://test-bucket/releases/new/release.json", calls[-1])
        with patch.object(publish, "aws", return_value='{"KeyCount":1}'):
            with self.assertRaisesRegex(ValueError, "already exists"):
                publish.upload(Path("out"), "test-bucket", "new")

    def test_rejects_partial_export_and_old_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            with self.assertRaisesRegex(ValueError, "Incomplete"):
                publish.validate_export(out)
            for name in ["index.html", "404.html", "tarot/index.html", "astrology/index.html",
                         "content/reading/semantics.1.json", "content/reading/rules.1.json",
                         "content/reading/reading.en.1.json", "_next/static/test.js"]:
                path = out / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture")
            for feature in ["tarot", "astrology"]:
                path = out / "engines" / feature
                path.mkdir(parents=True)
                (path / "engine.wasm").write_bytes(b"\0asmfixture")
                (path / "engine.mjs").write_text("fixture")
                (path / "worker.mjs").write_text("obsolete")
            with self.assertRaisesRegex(ValueError, "Stale Worker"):
                publish.validate_export(out)
            for feature in ["tarot", "astrology"]:
                (out / "engines" / feature / "worker.mjs").write_bytes((ROOT / "scripts/worker.mjs").read_bytes())
            publish.validate_export(out)

    def test_templates_keep_private_origin_real_404_and_repository_trust(self):
        template = json.loads((ROOT / "infra/template.json").read_text())
        resources = template["Resources"]
        self.assertTrue(all(resources["SiteBucket"]["Properties"]["PublicAccessBlockConfiguration"].values()))
        self.assertEqual(resources["SiteBucket"]["DeletionPolicy"], "Retain")
        config = resources["Distribution"]["Properties"]["DistributionConfig"]
        self.assertTrue(all(error["ResponseCode"] == 404 for error in config["CustomErrorResponses"]))
        self.assertEqual(resources["RouteRewrite"]["Properties"]["FunctionCode"], (ROOT / "infra/cloudfront-function.js").read_text())
        self.assertEqual(config["Origins"][0]["OriginPath"], {"Fn::Sub": "/releases/${ReleaseId}"})
        trust = json.loads((ROOT / "infra/bootstrap.json").read_text())["Resources"]["PublishRole"]["Properties"]["AssumeRolePolicyDocument"]["Statement"][0]
        self.assertEqual(trust["Condition"]["StringEquals"]["token.actions.githubusercontent.com:sub"],
                         {"Fn::Sub": "${GitHubSubjectPrefix}:ref:refs/heads/main"})

        parameters = json.loads((ROOT / "infra/bootstrap.json").read_text())["Parameters"]
        self.assertEqual(parameters["GitHubSubjectPrefix"]["Default"],
                         "repo:milocosmopolitan@5334538/pxoracle@1413138338")
        import re
        pattern = parameters["GitHubSubjectPrefix"]["AllowedPattern"]
        for bad in ["repo:*/*", "repo:owner/repo:pull_request", "repo:owner/repo:ref:refs/heads/other"]:
            self.assertIsNone(re.fullmatch(pattern, bad))


if __name__ == "__main__":
    unittest.main()
