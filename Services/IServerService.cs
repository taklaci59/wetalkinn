using DoWeTalk.Models;

namespace DoWeTalk.Services
{
    public interface IServerService
    {
        Task<Server> CreateServerAsync(string name, string ownerId);
        Task<bool> JoinServerAsync(string inviteCode, string userId);
        Task<bool> LeaveServerAsync(int serverId, string userId);
        Task<IEnumerable<object>> GetChannelsAsync(int serverId);
        Task<IEnumerable<object>> GetCategoriesAsync(int serverId);
        Task<bool> CreateCategoryAsync(int serverId, string name, string userId);
        Task<bool> UpdateCategoryAsync(int serverId, int categoryId, string name, string userId);
        Task<bool> DeleteCategoryAsync(int serverId, int categoryId, string userId);
        Task<bool> UpdateServerProfileAsync(int serverId, string name, string? iconUrl, string? bannerUrl, string userId);
        Task<bool> CreateChannelAsync(int serverId, string name, string userId, bool isVoice = false, int? categoryId = null);
        Task<bool> UpdateChannelAsync(int serverId, int channelId, string name, string userId, bool isVoice, int? categoryId);
        Task<bool> DeleteChannelAsync(int serverId, int channelId, string userId);
        Task<IEnumerable<object>> GetServerMembersAsync(int serverId);
        Task<string> GenerateInviteCodeAsync(int serverId);
        Task<bool> SetMemberRoleAsync(int serverId, string targetUserId, string role, string requesterId);
        Task<string?> GetMemberRoleAsync(int serverId, string userId);
        Task<int> GetServerIdByChannelIdAsync(int channelId);
        Task<bool> SetCustomUrlAsync(int serverId, string customUrl, string userId);
        Task<object?> GetServerSettingsAsync(int serverId, string userId);
        Task<JoinViewModel?> GetServerPublicInfoAsync(string inviteCode);
        Task<List<Server>> GetUserServersAsync(string userId);

        // Role Management
        Task<IEnumerable<object>> GetServerRolesAsync(int serverId);
        Task<bool> CreateRoleAsync(int serverId, string name, string userId);
        Task<bool> UpdateRoleAsync(int serverId, int roleId, string name, string colorHex, ServerPermissions permissions, int position, string userId);
        Task<bool> DeleteRoleAsync(int serverId, int roleId, string userId);
        Task<bool> AssignRoleToMemberAsync(int serverId, string targetUserId, int roleId, string userId);
        Task<bool> RemoveRoleFromMemberAsync(int serverId, string targetUserId, int roleId, string userId);
    }
}
