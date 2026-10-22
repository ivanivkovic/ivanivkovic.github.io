# Ivan Ivkovic personal website

The site is hosted by GitHub Pages from the root of the `master` branch in `ivanivkovic/ivanivkovic.github.io`.

- Primary domain: https://ivanivkovic.me
- GitHub Pages source: https://github.com/ivanivkovic/ivanivkovic.github.io/tree/master
- `CNAME` records the custom domain. Keep it in the publishing branch.

## Publish updates

Commit and push site changes to `master`. GitHub Pages automatically builds and deploys the branch; no AWS deployment command is required for the primary site.

## GoDaddy DNS

GitHub has accepted `ivanivkovic.me` as the custom domain. Public authoritative DNS currently returns the GoDaddy parking addresses `3.33.130.190` and `15.197.148.33`; these are observed DNS answers, not a snapshot of the GoDaddy editor. Identify the existing A record or managed parking entry named `@` in GoDaddy and replace that parking configuration with all four A records below. If the entry is locked, inspect domain forwarding before making changes. Edit the existing `www` CNAME to point directly to the GitHub Pages hostname.

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `ivanivkovic.github.io` |

Use the default TTL. Preserve MX records and email-related TXT records. Do not add a CNAME at the root (`@`). The AWS validation CNAMEs and ownership TXT record can remain while the old AWS resources are retained.

Once DNS resolves to GitHub, GitHub can provision a TLS certificate. Enable **Enforce HTTPS** in the repository's Pages settings when the certificate is available. The configured primary domain is the bare domain; a correctly configured `www` record redirects there.

References: [GitHub custom domains and DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Previous AWS hosting

The secondary CloudFront URL remains https://d1jqfe9oaws8g7.cloudfront.net. Its S3 bucket and distribution have not been deleted. Neither `ivanivkovic.me` nor `www.ivanivkovic.me` is attached to that distribution because both names are associated with an inaccessible, enabled distribution in another AWS account.

The previous deployment details and troubleshooting notes are preserved in [infra/cloudfront-hosting.md](infra/cloudfront-hosting.md). They are not needed to publish the GitHub Pages site.
