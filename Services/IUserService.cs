using DoWeTalk.Models;

namespace DoWeTalk.Services
{
    public interface IUserService
    {
        Task<bool> SendFriendRequestAsync(string senderId, string targetId);
        Task<IEnumerable<object>> GetPendingRequestsAsync(string userId);
        Task<bool> RespondFriendRequestAsync(int requestId, string currentUserId, bool accept);
        Task<IEnumerable<object>> GetFriendsAsync(string userId);
        Task<bool> BlockUserAsync(string blockerId, string blockedId);
        Task<bool> UnblockUserAsync(string blockerId, string blockedId);
        Task<IEnumerable<object>> GetBlockedUsersAsync(string userId);
        Task<int> GetPendingRequestCountAsync(string userId);
        Task<List<string>> GetFriendIdsAsync(string userId);
        Task<bool> UpdateProfileAsync(string userId, string bio, string avatarUrl, string? nickname = null);
    }
}
