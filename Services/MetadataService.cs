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
    }
}
