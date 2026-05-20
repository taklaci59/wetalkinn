## 2025-05-20 - SSRF Vulnerability in URL Unfurling
**Vulnerability:** The `MetadataService` was fetching arbitrary URLs provided by users without validation, leading to potential Server-Side Request Forgery (SSRF).
**Learning:** URL unfurling services must strictly validate target URLs to prevent access to internal networks, loopback addresses, and cloud metadata services.
**Prevention:** Implement strict URL validation: ensure absolute URLs, allow only HTTP/HTTPS schemes, and verify that resolved IP addresses are not in private or reserved ranges.
