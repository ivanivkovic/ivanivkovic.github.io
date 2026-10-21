# AWS Support request: stale CloudFront domain association

Subject: Move www.ivanivkovic.me from an inaccessible CloudFront distribution

Please verify my domain ownership and move the alternate domain name `www.ivanivkovic.me` to my CloudFront distribution.

I am the current domain registrant and control its GoDaddy DNS, but I do not have access to the AWS account holding the existing association.

Target details:

- AWS account: `500527826031`
- Target distribution ID: `E2CKAYNCFFB4QM`
- Target distribution domain: `d1jqfe9oaws8g7.cloudfront.net`
- Issued ACM certificate in `us-east-1`: `arn:aws:acm:us-east-1:500527826031:certificate/05bd5cd3-329b-48fe-b4ec-4bb1601c8ab1`
- The issued certificate is attached to the target distribution, which is deployed.

Domain ownership proof is published in public DNS:

```text
_www.ivanivkovic.me TXT "d1jqfe9oaws8g7.cloudfront.net"
```

The ACM validation CNAME records are also published and validated.

`ListDomainConflicts` identifies the source as a standard distribution ending in `65PNT0T`, in account ending in `351177`.

Attempts to attach or transfer the domain return:

- CloudFormation distribution update: `CNAMEAlreadyExists` / already associated with a different resource.
- `UpdateDomainAssociation`: `InvalidAssociation` / domain already in use in another account.
- `AssociateAlias`: `IllegalUpdate: Alias move is not allowed since the source distribution is enabled.`

Please use the CloudFront domain-ownership transfer process to move this association to the target distribution. The `www` routing CNAME will be updated after the transfer completes. Do not change unrelated DNS or email records.

AWS procedure: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/alternate-domain-names-move-options.html
