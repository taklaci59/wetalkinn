using System.Collections.Generic;
using System.Threading.Tasks;

namespace DoWeTalk.Services
{
    public interface IPresenceService
    {
        Task<bool> UserConnectedAsync(string userId, string connectionId);
        Task<bool> UserDisconnectedAsync(string userId, string connectionId);
        Task<string[]> GetOnlineUsersAsync();
        Task<bool> IsUserOnlineAsync(string userId);
        Task<IDictionary<string, bool>> GetPresenceAsync(IEnumerable<string> userIds);
        
        // Voice Channel Occupancy
        Task UpdateVoiceChannelPresenceAsync(string userId, int channelId);
        Task RemoveVoiceChannelPresenceAsync(string userId);
        Task<List<string>> GetChannelOccupantsAsync(int channelId);
    }
}
