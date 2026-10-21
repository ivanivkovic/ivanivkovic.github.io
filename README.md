# Ivan Ivkovic personal website

The original HTML/CSS site is hosted on Amazon CloudFront with a private S3 origin.

- CloudFront: https://d1jqfe9oaws8g7.cloudfront.net
- Custom domain, after DNS validation and activation: https://www.ivanivkovic.me
- AWS region: `eu-central-1`
- CloudFormation stack: `ivanivkovic-personal-website`
- Distribution: `E2CKAYNCFFB4QM`

## Deploy

Install AWS CLI v2 and authenticate to the website's AWS account. From the repository root:

```sh
python3 scripts/deploy.py
```

The script deploys `infra/cloudfront.json`, uploads only public site files, removes obsolete objects from this website's bucket, and waits for a CloudFront cache invalidation. Infrastructure and deployment scripts are excluded from S3. An already-enabled custom domain stays enabled on later deployments. Changes pushed to GitHub must also be deployed with this command; there is no automatic GitHub-to-AWS pipeline.

The bucket blocks public access. CloudFront uses signed origin requests, redirects HTTP to HTTPS, and caches site content for five minutes. The bucket is retained if the infrastructure stack is deleted. Hosting uses AWS pay-as-you-go services.

## Connect the GoDaddy domain

In GoDaddy, open `ivanivkovic.me` and select **DNS**. Add these certificate-validation records, using the names exactly as shown without appending the domain. Leave TTL at its default.

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `_39ee25353a7d4d25b2cd6498e9c846f9.www` | `_51a6802b5cfb6bf2091db52acbeed14c.wzccmgtwzk.acm-validations.aws` |
| CNAME | `_1b25f8f290f6ef672ed24dbc315fd5b2` | `_e39ea11d5fd6f11e990f9eda365ba100.wzccmgtwzk.acm-validations.aws` |

Keep both validation records for automatic certificate renewal. The ACM certificate is in `us-east-1`, as required by CloudFront. Its ARN is recorded in `infra/settings.json`.

After ACM reports `ISSUED`, enable the custom domain and wait for deployment to finish:

```sh
python3 scripts/deploy.py --enable-domain
```

Then edit the existing `www` CNAME record:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `d1jqfe9oaws8g7.cloudfront.net` |

Enter just the CloudFront hostname, without `https://` or a path. Replace the existing `www` record rather than adding a conflicting duplicate. Preserve MX, TXT, and other email records. Check https://www.ivanivkovic.me after DNS propagation.

This setup connects `www.ivanivkovic.me`. The bare `ivanivkovic.me` domain still uses its existing routing; its forwarding can be configured separately. Do not create a CNAME at the root (`@`).

References: [CloudFront certificate requirements](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html), [private S3 origins](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html), [GoDaddy CNAME records](https://www.godaddy.com/help/add-a-cname-record-19236).
