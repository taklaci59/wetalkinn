using DoWeTalk.Models;

namespace DoWeTalk.Services
{
    public interface IChatService
    {
        Task<ChatMessage> SaveChannelMessageAsync(int channelId, string senderId, string content);
        Task<ChatMessage> SavePrivateMessageAsync(string senderId, string receiverId, string content);
        Task<IEnumerable<object>> GetChannelMessagesAsync(int channelId, int skip, int take);
        Task<IEnumerable<object>> GetPrivateMessagesAsync(string userId, string otherUserId, int skip, int take);
    }
}
