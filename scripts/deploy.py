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
    domain_mode = parser.add_mutually_exclusive_group()
    domain_mode.add_argument("--enable-domain", action="store_true", help="Attach the custom domain after ACM DNS validation; leave site files unchanged")
    domain_mode.add_argument("--prepare-domain", action="store_true", help="Attach the certificate without the domain, to prepare an ownership transfer; leave site files unchanged")
    args = parser.parse_args()
    certificate = aws("acm", "describe-certificate", "--certificate-arn", SETTINGS["certificate_arn"], region="us-east-1")["Certificate"]
    if (args.enable_domain or args.prepare_domain) and certificate["Status"] != "ISSUED":
        raise SystemExit(f"Certificate is {certificate['Status']}; add the validation CNAMEs before enabling the domain.")

    # Preserve an already-enabled custom domain on ordinary content deployments.
    stack_list = aws("cloudformation", "list-stacks", "--query", "StackSummaries[?StackStatus!='DELETE_COMPLETE']")
    existing = next((s for s in stack_list if s["StackName"] == SETTINGS["stack_name"]), None)
    current_certificate = ""
    domain_enabled = "true"
    if existing:
        stack = aws("cloudformation", "describe-stacks", "--stack-name", SETTINGS["stack_name"])["Stacks"][0]
        current_certificate = next((p["ParameterValue"] for p in stack.get("Parameters", []) if p["ParameterKey"] == "CertificateArn"), "")
        domain_enabled = next((p["ParameterValue"] for p in stack.get("Parameters", []) if p["ParameterKey"] == "EnableCustomDomain"), "true")
    certificate_arn = SETTINGS["certificate_arn"] if args.enable_domain or args.prepare_domain else current_certificate
    if args.enable_domain:
        domain_enabled = "true"
    elif args.prepare_domain:
        domain_enabled = "false"
    aws("cloudformation", "deploy", "--stack-name", SETTINGS["stack_name"], "--template-file", str(ROOT / "infra/cloudfront.json"),
        "--parameter-overrides", f"DomainName={SETTINGS['domain_name']}", f"CertificateArn={certificate_arn}", f"EnableCustomDomain={domain_enabled}",
        "--tags", "Project=PersonalWebsite", "--no-fail-on-empty-changeset", capture=False)
    stack = aws("cloudformation", "describe-stacks", "--stack-name", SETTINGS["stack_name"])["Stacks"][0]
    outputs = {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}
    (ROOT / "infra/deployment.json").write_text(json.dumps(outputs, indent=2) + "\n")
    if args.enable_domain or args.prepare_domain:
        print(json.dumps(outputs, indent=2))
        print("Custom domain configured." if args.enable_domain else "Certificate attached; ready for domain ownership transfer.")
        return
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
    if certificate_arn and domain_enabled == "true":
        print(f"Custom domain configured: https://{SETTINGS['domain_name']}")
    elif certificate_arn:
        print("Certificate attached; custom domain is awaiting ownership transfer.")
    else:
        print("CloudFront URL is live. After certificate validation: python3 scripts/deploy.py --enable-domain")


if __name__ == "__main__":
    main()
