#!/usr/bin/env python3
"""Deploy the original static website to private S3 and CloudFront using AWS CLI v2."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = json.loads((ROOT / "infra/settings.json").read_text())
PUBLIC_PATHS = ("index.html", "robots.txt", "favicon.png", "logo.png", "style", "bgs", "profile", "files", ".well-known")


def aws(*args, region=None, capture=True):
    command = ["aws", "--region", region or SETTINGS["region"], "--no-cli-pager", "--output", "json", *args]
    result = subprocess.run(command, check=True, text=True, capture_output=capture)
    return json.loads(result.stdout) if capture and result.stdout.strip() else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enable-domain", action="store_true", help="Attach the custom domain after ACM DNS validation")
    args = parser.parse_args()
    certificate = aws("acm", "describe-certificate", "--certificate-arn", SETTINGS["certificate_arn"], region="us-east-1")["Certificate"]
    if args.enable_domain and certificate["Status"] != "ISSUED":
        raise SystemExit(f"Certificate is {certificate['Status']}; add the validation CNAMEs before enabling the domain.")

    # Preserve an already-enabled custom domain on ordinary content deployments.
    stack_list = aws("cloudformation", "list-stacks", "--query", "StackSummaries[?StackStatus!='DELETE_COMPLETE']")
    existing = next((s for s in stack_list if s["StackName"] == SETTINGS["stack_name"]), None)
    current_certificate = ""
    if existing:
        stack = aws("cloudformation", "describe-stacks", "--stack-name", SETTINGS["stack_name"])["Stacks"][0]
        current_certificate = next((p["ParameterValue"] for p in stack.get("Parameters", []) if p["ParameterKey"] == "CertificateArn"), "")
    certificate_arn = SETTINGS["certificate_arn"] if args.enable_domain else current_certificate
    aws("cloudformation", "deploy", "--stack-name", SETTINGS["stack_name"], "--template-file", str(ROOT / "infra/cloudfront.json"),
        "--parameter-overrides", f"DomainName={SETTINGS['domain_name']}", f"CertificateArn={certificate_arn}",
        "--tags", "Project=PersonalWebsite", "--no-fail-on-empty-changeset", capture=False)
    stack = aws("cloudformation", "describe-stacks", "--stack-name", SETTINGS["stack_name"])["Stacks"][0]
    outputs = {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}
    (ROOT / "infra/deployment.json").write_text(json.dumps(outputs, indent=2) + "\n")
    with tempfile.TemporaryDirectory(prefix="personal-website-") as staging_dir:
        staging = Path(staging_dir)
        for name in PUBLIC_PATHS:
            source = ROOT / name
            if not source.exists():
                raise SystemExit(f"Missing public source: {name}")
            if source.is_dir():
                shutil.copytree(source, staging / name, ignore=shutil.ignore_patterns(".DS_Store"))
            else:
                shutil.copy2(source, staging / name)
        aws("s3", "sync", str(staging), f"s3://{outputs['BucketName']}/", "--delete", "--cache-control", "public,max-age=300", "--only-show-errors", capture=False)
    invalidation = aws("cloudfront", "create-invalidation", "--distribution-id", outputs["DistributionId"], "--paths", "/*")["Invalidation"]["Id"]
    aws("cloudfront", "wait", "invalidation-completed", "--distribution-id", outputs["DistributionId"], "--id", invalidation, capture=False)
    print(json.dumps(outputs, indent=2))
    if certificate_arn:
        print(f"Custom domain configured: https://{SETTINGS['domain_name']}")
    else:
        print("CloudFront URL is live. After certificate validation: python3 scripts/deploy.py --enable-domain")


if __name__ == "__main__":
    main()
