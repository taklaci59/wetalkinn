using HtmlAgilityPack;
using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace DoWeTalk.Services
{
    public class MetadataService : IMetadataService
    {
        private readonly HttpClient _httpClient;

        public MetadataService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            _httpClient.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
            _httpClient.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        }

        public async Task<UrlMetadata> GetMetadataAsync(string url)
        {
            try
            {
                if (!await IsUrlSafe(url))
                {
                    return null;
                }

                var response = await _httpClient.GetStringAsync(url);
                var doc = new HtmlDocument();
                doc.LoadHtml(response);

                var metadata = new UrlMetadata
                {
                    Url = url,
                    Title = GetMetaTag(doc, "og:title") ?? doc.DocumentNode.SelectSingleNode("//title")?.InnerText,
                    Description = GetMetaTag(doc, "og:description") ?? GetMetaTag(doc, "description"),
                    ImageUrl = GetMetaTag(doc, "og:image"),
                    SiteName = GetMetaTag(doc, "og:site_name"),
                    Type = GetMetaTag(doc, "og:type")
                };

                // Clean up title and description
                if (!string.IsNullOrEmpty(metadata.Title)) metadata.Title = metadata.Title.Trim();
                if (!string.IsNullOrEmpty(metadata.Description)) metadata.Description = metadata.Description.Trim();

                return metadata;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching metadata for {url}: {ex.Message}");
                return null;
            }
        }

        private string GetMetaTag(HtmlDocument doc, string property)
        {
            var node = doc.DocumentNode.SelectSingleNode($"//meta[@property='{property}']") 
                       ?? doc.DocumentNode.SelectSingleNode($"//meta[@name='{property}']");
            return node?.GetAttributeValue("content", null);
        }

        private async Task<bool> IsUrlSafe(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return false;
            }

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                return false;
            }

            try
            {
                var host = uri.DnsSafeHost;
                var addresses = await System.Net.Dns.GetHostAddressesAsync(host);

                foreach (var address in addresses)
                {
                    if (System.Net.IPAddress.IsLoopback(address)) return false;

                    // Check for private IP ranges (IPv4)
                    if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                    {
                        byte[] bytes = address.GetAddressBytes();
                        // 10.0.0.0/8
                        if (bytes[0] == 10) return false;
                        // 172.16.0.0/12
                        if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return false;
                        // 192.168.0.0/16
                        if (bytes[0] == 192 && bytes[1] == 168) return false;
                        // 169.254.0.0/16 (Link-local)
                        if (bytes[0] == 169 && bytes[1] == 254) return false;
                    }
                    // Check for private/local IP ranges (IPv6)
                    else if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
                    {
                        if (address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6UniqueLocal) return false;
                    }
                }
            }
            catch
            {
                return false;
            }

            return true;
        }
    }
}
