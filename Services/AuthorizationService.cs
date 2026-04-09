using DoWeTalk.Data.Repositories;
using DoWeTalk.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DoWeTalk.Services
{
    public class AuthorizationService : IAuthorizationService
    {
        private readonly IRepository<Friendship> _friendRepo;
        private readonly IRepository<BlockedUser> _blockRepo;
        private readonly IRepository<ServerMember> _serverMemberRepo;
        private readonly IRepository<ServerRole> _roleRepo;
        private readonly IRepository<ServerMemberRole> _smrRepo;
        private readonly IRepository<Server> _serverRepo;
        private readonly Dictionary<(string UserId, int ServerId), ServerPermissions> _permissionCache = new();

        public AuthorizationService(
            IRepository<Friendship> friendRepo,
            IRepository<BlockedUser> blockRepo,
            IRepository<ServerMember> serverMemberRepo,
            IRepository<ServerRole> roleRepo,
            IRepository<ServerMemberRole> smrRepo,
            IRepository<Server> serverRepo)
        {
            _friendRepo = friendRepo;
            _blockRepo = blockRepo;
            _serverMemberRepo = serverMemberRepo;
            _roleRepo = roleRepo;
            _smrRepo = smrRepo;
            _serverRepo = serverRepo;
        }

        public async Task<bool> IsBlockedAsync(string userId, string targetId)
        {
            return await _blockRepo.Query().AnyAsync(b => 
                (b.BlockerId == userId && b.BlockedId == targetId) || 
                (b.BlockedId == userId && b.BlockerId == targetId));
        }

        public async Task<bool> AreFriendsAsync(string userId, string targetId)
        {
            return await _friendRepo.Query().AnyAsync(f => 
                ((f.User1Id == userId && f.User2Id == targetId) || 
                 (f.User1Id == targetId && f.User2Id == userId)) && 
                f.IsAccepted);
        }

        public async Task<bool> CanSendMessageAsync(string senderId, string receiverId)
        {
            if (senderId == receiverId) return false;

            var isBlocked = await IsBlockedAsync(senderId, receiverId);
            if (isBlocked) return false;

            var areFriends = await AreFriendsAsync(senderId, receiverId);
            return areFriends;
        }

        public async Task<List<string>> FilterBlockedUsersAsync(string senderId, List<string> targetUserIds)
        {
            if (targetUserIds == null || !targetUserIds.Any()) return new List<string>();

            var blockedIds = await _blockRepo.Query()
                .Where(b => (b.BlockerId == senderId && targetUserIds.Contains(b.BlockedId)) || 
                            (b.BlockedId == senderId && targetUserIds.Contains(b.BlockerId)))
                .Select(b => b.BlockerId == senderId ? b.BlockedId : b.BlockerId)
                .ToListAsync();

            var blockedSet = new HashSet<string>(blockedIds);
            return targetUserIds.Where(id => !blockedSet.Contains(id)).ToList();
        }

        public async Task<bool> CanSendFriendRequestAsync(string senderId, string targetId)
        {
            if (senderId == targetId) return false;

            var isBlocked = await IsBlockedAsync(senderId, targetId);
            if (isBlocked) return false;

            var requestExists = await _friendRepo.Query().AnyAsync(f =>
                (f.User1Id == senderId && f.User2Id == targetId) ||
                (f.User1Id == targetId && f.User2Id == senderId));

            return !requestExists;
        }

        public async Task<bool> HasServerRoleAsync(string userId, int serverId, params string[] roles)
        {
            if (roles == null || roles.Length == 0) return true;

            return await _smrRepo.Query()
                .Include(smr => smr.ServerRole)
                .Include(smr => smr.ServerMember)
                .AnyAsync(smr => 
                    smr.ServerMember.ServerId == serverId && 
                    smr.ServerMember.UserId == userId && 
                    roles.Contains(smr.ServerRole.Name));
        }

        // New Permission System Implementation
        public async Task<ServerPermissions> GetUserPermissionsAsync(string userId, int serverId)
        {
            if (_permissionCache.TryGetValue((userId, serverId), out var cached))
                return cached;

            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return ServerPermissions.None;

            ServerPermissions permissions = ServerPermissions.None;

            // ABSOLUTE OWNER PROTECTION
            if (server.OwnerId == userId)
            {
                permissions = ServerPermissions.Administrator;
            }
            else
            {
                var member = await _serverMemberRepo.Query()
                    .Include(m => m.Server)
                    .FirstOrDefaultAsync(m => m.ServerId == serverId && m.UserId == userId);

                if (member != null)
                {
                    // Get user's active roles
                    var userRoles = await _smrRepo.Query()
                        .Where(smr => smr.ServerMemberId == member.Id)
                        .Select(smr => smr.ServerRole)
                        .ToListAsync();

                    // Get @everyone role
                    var everyoneRole = await _roleRepo.Query()
                        .FirstOrDefaultAsync(r => r.ServerId == serverId && r.IsDefault);

                    if (everyoneRole != null)
                    {
                        permissions |= everyoneRole.Permissions;
                    }

                    foreach (var role in userRoles)
                    {
                        permissions |= role.Permissions;
                    }
                }
            }

            _permissionCache[(userId, serverId)] = permissions;
            return permissions;
        }

        public async Task<bool> HasPermissionAsync(string userId, int serverId, ServerPermissions requiredPermission)
        {
            var permissions = await GetUserPermissionsAsync(userId, serverId);
            
            if ((permissions & ServerPermissions.Administrator) == ServerPermissions.Administrator)
                return true;

            return (permissions & requiredPermission) == requiredPermission;
        }

        public async Task<int> GetHighestRolePositionAsync(string userId, int serverId)
        {
            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return -1;

            if (server.OwnerId == userId) return int.MaxValue;

            var member = await _serverMemberRepo.Query()
                .FirstOrDefaultAsync(m => m.ServerId == serverId && m.UserId == userId);

            if (member == null) return -1;

            var highestPosition = await _smrRepo.Query()
                .Where(smr => smr.ServerMemberId == member.Id)
                .Select(smr => smr.ServerRole.Position)
                .DefaultIfEmpty(0) // Default to 0 for @everyone position
                .MaxAsync();

            return highestPosition;
        }

        public async Task<bool> CanManageRoleAsync(string userId, int serverId, int targetRoleId)
        {
            var actingUserHighestPos = await GetHighestRolePositionAsync(userId, serverId);
            
            var targetRole = await _roleRepo.GetByIdAsync(targetRoleId);
            if (targetRole == null || targetRole.ServerId != serverId) return false;

            // Can't delete/edit @everyone via this check usually, but hierarchy says: 
            // Pos must be strictly greater than target's Pos.
            return actingUserHighestPos > targetRole.Position;
        }
    }
}
