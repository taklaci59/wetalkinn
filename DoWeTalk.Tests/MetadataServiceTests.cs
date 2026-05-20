using System.Threading.Tasks;
using System.Net.Http;
using DoWeTalk.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace DoWeTalk.Tests
{
    [TestClass]
    public class MetadataServiceTests
    {
        [TestMethod]
        public async Task GetMetadataAsync_ShouldReturnNull_ForLocalhost()
        {
            // Arrange
            using var httpClient = new HttpClient();
            var metadataService = new MetadataService(httpClient);
            string localUrl = "http://127.0.0.1";

            // Act
            var result = await metadataService.GetMetadataAsync(localUrl);

            // Assert
            Assert.IsNull(result);
        }

        [TestMethod]
        public async Task GetMetadataAsync_ShouldReturnNull_ForPrivateIp()
        {
            // Arrange
            using var httpClient = new HttpClient();
            var metadataService = new MetadataService(httpClient);
            string privateUrl = "http://192.168.1.1";

            // Act
            var result = await metadataService.GetMetadataAsync(privateUrl);

            // Assert
            Assert.IsNull(result);
        }
    }
}
