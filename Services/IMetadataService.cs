using System.Threading.Tasks;

namespace DoWeTalk.Services
{
    public interface IMetadataService
    {
        Task<UrlMetadata> GetMetadataAsync(string url);
    }

    public class UrlMetadata
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public string ImageUrl { get; set; }
        public string SiteName { get; set; }
        public string Url { get; set; }
        public string Type { get; set; } // video, image, article, etc.
    }
}
