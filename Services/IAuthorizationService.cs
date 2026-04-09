using System.Collections.Generic;
using System.Threading.Tasks;
using DoWeTalk.Models;

namespace DoWeTalk.Services
{
    public interface IAuthorizationService
    {
        Task<bool> CanSendMessageAsync(string senderId, string targetId);
        Task<bool> CanSendFriendRequestAsync(string senderId, string targetId);
        Task<bool> IsBlockedAsync(string blockerId, string blockedId);
        Task<bool> AreFriendsAsync(string userId, string targetId);
        Task<bool> HasServerRoleAsync(string userId, int serverId, params string[] allowedRoles);
        Task<List<string>> FilterBlockedUsersAsync(string senderId, List<string> targetUserIds);
        
        // New Permission System
        Task<ServerPermissions> GetUserPermissionsAsync(string userId, int serverId);
        Task<bool> HasPermissionAsync(string userId, int serverId, ServerPermissions requiredPermission);
        Task<int> GetHighestRolePositionAsync(string userId, int serverId);
        Task<bool> CanManageRoleAsync(string userId, int serverId, int targetRoleId);
    }
}
