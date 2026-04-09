using DoWeTalk.Data;
using DoWeTalk.Data.Repositories;
using DoWeTalk.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DoWeTalk.Services
{
    public class ServerService : IServerService
    {
        private readonly IRepository<Server> _serverRepo;
        private readonly IRepository<Channel> _channelRepo;
        private readonly IRepository<ServerMember> _memberRepo;
        private readonly IRepository<Category> _categoryRepo;
        private readonly IRepository<ServerRole> _roleRepo;
        private readonly IRepository<ServerMemberRole> _smrRepo;
        private readonly IAuthorizationService _authService;
        private readonly ApplicationDbContext _dbContext;
        private readonly IPresenceService _presenceService;

        public ServerService(
            IRepository<Server> serverRepo, 
            IRepository<Channel> channelRepo, 
            IRepository<ServerMember> memberRepo, 
            IRepository<Category> categoryRepo,
            IRepository<ServerRole> roleRepo,
            IRepository<ServerMemberRole> smrRepo,
            IAuthorizationService authService,
            ApplicationDbContext dbContext,
            IPresenceService presenceService)
        {
            _serverRepo = serverRepo;
            _channelRepo = channelRepo;
            _memberRepo = memberRepo;
            _categoryRepo = categoryRepo;
            _roleRepo = roleRepo;
            _smrRepo = smrRepo;
            _authService = authService;
            _dbContext = dbContext;
            _presenceService = presenceService;
        }

        public async Task<Server> CreateServerAsync(string name, string ownerId)
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                var server = new Server
                {
                    Name = name,
                    OwnerId = ownerId,
                    InviteCode = Guid.NewGuid().ToString().Substring(0, 8).ToUpper(),
                    CreatedAt = DateTime.UtcNow
                };

                await _serverRepo.AddAsync(server);
                await _serverRepo.SaveChangesAsync();

                // 1. Create Initial Roles (all required fields populated)
                var everyoneRole = new ServerRole
                {
                    ServerId = server.Id,
                    Name = "@everyone",
                    Position = 0,
                    IsDefault = true,
                    ColorHex = "#99aab5",
                    Permissions = ServerPermissions.SendMessages
                };
                await _roleRepo.AddAsync(everyoneRole);

                var adminRole = new ServerRole
                {
                    ServerId = server.Id,
                    Name = "Administrator",
                    Position = 999,
                    ColorHex = "#ff0000",
                    Permissions = ServerPermissions.Administrator
                };
                await _roleRepo.AddAsync(adminRole);
                await _roleRepo.SaveChangesAsync();

                // 2. Add Owner as Member
                var member = new ServerMember { ServerId = server.Id, UserId = ownerId };
                await _memberRepo.AddAsync(member);
                await _memberRepo.SaveChangesAsync();

                // 3. Assign Roles to Owner (owner bypasses checks, but roles needed for UI/visibility)
                await _smrRepo.AddAsync(new ServerMemberRole { ServerMemberId = member.Id, ServerRoleId = everyoneRole.Id });
                await _smrRepo.AddAsync(new ServerMemberRole { ServerMemberId = member.Id, ServerRoleId = adminRole.Id });

                // 4. Default Channels
                await _channelRepo.AddAsync(new Channel { Name = "genel", ServerId = server.Id, IsVoice = false });
                await _channelRepo.AddAsync(new Channel { Name = "Sesli Kanal", ServerId = server.Id, IsVoice = true });
                await _channelRepo.SaveChangesAsync();

                await transaction.CommitAsync();
                return server;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<bool> CreateChannelAsync(int serverId, string name, string userId, bool isVoice = false, int? categoryId = null)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageChannels))
                return false;

            await _channelRepo.AddAsync(new Channel
            {
                Name = name.ToLower().Replace(" ", "-"),
                ServerId = serverId,
                IsVoice = isVoice,
                CategoryId = categoryId
            });
            await _channelRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateChannelAsync(int serverId, int channelId, string name, string userId, bool isVoice, int? categoryId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageChannels)) return false;
            var ch = await _channelRepo.Query().FirstOrDefaultAsync(c => c.Id == channelId && c.ServerId == serverId);
            if (ch == null) return false;
            ch.Name = name.ToLower().Replace(" ", "-");
            ch.IsVoice = isVoice;
            ch.CategoryId = categoryId;
            await _channelRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteChannelAsync(int serverId, int channelId, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageChannels)) return false;
            var ch = await _channelRepo.Query().FirstOrDefaultAsync(c => c.Id == channelId && c.ServerId == serverId);
            if (ch == null) return false;
            _channelRepo.Remove(ch);
            await _channelRepo.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<object>> GetCategoriesAsync(int serverId)
        {
            return await _categoryRepo.Query()
                .Where(c => c.ServerId == serverId)
                .OrderBy(c => c.Order)
                .Select(c => new { id = c.Id, name = c.Name, order = c.Order })
                .ToListAsync();
        }

        public async Task<bool> CreateCategoryAsync(int serverId, string name, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageCategories))
                return false;

            await _categoryRepo.AddAsync(new Category { Name = name, ServerId = serverId });
            await _categoryRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateCategoryAsync(int serverId, int categoryId, string name, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageCategories))
                return false;

            var cat = await _categoryRepo.GetByIdAsync(categoryId);
            if (cat == null || cat.ServerId != serverId) return false;

            cat.Name = name;
            _categoryRepo.Update(cat);
            await _categoryRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteCategoryAsync(int serverId, int categoryId, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageCategories))
                return false;

            var cat = await _categoryRepo.GetByIdAsync(categoryId);
            if (cat == null || cat.ServerId != serverId) return false;

            using var transaction = await _dbContext.Database.BeginTransactionAsync();
            try
            {
                // Move channels to root instead of crashing/deleting them
                var channels = await _channelRepo.Query()
                    .Where(c => c.CategoryId == categoryId)
                    .ToListAsync();

                foreach (var ch in channels)
                {
                    ch.CategoryId = null;
                    _channelRepo.Update(ch);
                }

                _categoryRepo.Remove(cat);
                await _dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                return false;
            }
        }

        public async Task<bool> UpdateServerProfileAsync(int serverId, string name, string? iconUrl, string? bannerUrl, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageServer))
                return false;

            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return false;

            if (!string.IsNullOrWhiteSpace(name)) server.Name = name;
            if (iconUrl != null) server.IconUrl = iconUrl;
            if (bannerUrl != null) server.BannerUrl = bannerUrl;

            _serverRepo.Update(server);
            await _serverRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> JoinServerAsync(string inviteCode, string userId)
        {
            var server = await _serverRepo.Query()
                .FirstOrDefaultAsync(s => s.InviteCode == inviteCode || s.CustomUrl == inviteCode);
            if (server == null) return false;

            var membership = await _memberRepo.Query()
                .FirstOrDefaultAsync(m => m.ServerId == server.Id && m.UserId == userId);
            
            if (membership != null) return true;
            
            membership = new ServerMember { ServerId = server.Id, UserId = userId };
            await _memberRepo.AddAsync(membership);
            await _memberRepo.SaveChangesAsync();

            // Assign @everyone role automatically
            var everyoneRole = await _roleRepo.Query()
                .FirstOrDefaultAsync(r => r.ServerId == server.Id && r.IsDefault);
            
            if (everyoneRole != null)
            {
                await _smrRepo.AddAsync(new ServerMemberRole { ServerMemberId = membership.Id, ServerRoleId = everyoneRole.Id });
                await _smrRepo.SaveChangesAsync();
            }

            return true;
        }

        public async Task<bool> LeaveServerAsync(int serverId, string userId)
        {
            var membership = await _memberRepo.Query().FirstOrDefaultAsync(m => m.ServerId == serverId && m.UserId == userId);
            if (membership == null) return false;

            // Cannot leave if owner (must transfer first)
            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server != null && server.OwnerId == userId) return false;

            _memberRepo.Remove(membership);
            await _memberRepo.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<object>> GetChannelsAsync(int serverId)
        {
            return await _channelRepo.Query()
                .Where(c => c.ServerId == serverId)
                .Select(c => new { id = c.Id, name = c.Name, isVoice = c.IsVoice, categoryId = c.CategoryId })
                .ToListAsync();
        }

        public async Task<IEnumerable<object>> GetServerMembersAsync(int serverId)
        {
            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return Enumerable.Empty<object>();

            var members = await _memberRepo.Query()
                .Include(m => m.User)
                .Where(m => m.ServerId == serverId)
                .ToListAsync();

            var userIds = members.Select(m => m.UserId).Distinct().ToList();
            var presenceMap = await _presenceService.GetPresenceAsync(userIds);

            var memberIds = members.Select(m => m.Id).ToList();
            var allMemberRoles = await _smrRepo.Query()
                .Include(smr => smr.ServerRole)
                .Where(smr => memberIds.Contains(smr.ServerMemberId))
                .ToListAsync();

            var result = new List<object>();
            foreach (var m in members)
            {
                var userRoles = allMemberRoles
                    .Where(smr => smr.ServerMemberId == m.Id)
                    .Select(smr => new { 
                        id = smr.ServerRole.Id, 
                        name = smr.ServerRole.Name, 
                        color = smr.ServerRole.ColorHex, 
                        position = smr.ServerRole.Position 
                    })
                    .OrderByDescending(r => r.position)
                    .ToList();

                // Deterministic primary role resolution
                string primaryRoleName = "@everyone";
                string primaryRoleColor = "#949ba4";
                int highestPosition = -1;
                bool isOwner = m.UserId == server.OwnerId;

                if (isOwner)
                {
                    primaryRoleName = "Owner";
                    primaryRoleColor = "#f1c40f"; // Gold
                    highestPosition = 9999;
                }
                else if (userRoles.Any())
                {
                    var topRole = userRoles.First();
                    primaryRoleName = topRole.name;
                    primaryRoleColor = topRole.color;
                    highestPosition = topRole.position;
                }

                result.Add(new {
                    userId = m.UserId,
                    username = m.User.UserName,
                    nickname = m.User.Nickname,
                    isOnline = presenceMap.ContainsKey(m.UserId) && presenceMap[m.UserId],
                    isOwner = isOwner,
                    primaryRoleName = primaryRoleName,
                    primaryRoleColor = primaryRoleColor,
                    rolePosition = highestPosition,
                    roles = userRoles
                });
            }
            return result;
        }

        public async Task<string> GenerateInviteCodeAsync(int serverId)
        {
            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return null;

            if (string.IsNullOrEmpty(server.InviteCode))
            {
                server.InviteCode = Guid.NewGuid().ToString().Substring(0, 8).ToUpper();
                _serverRepo.Update(server);
                await _serverRepo.SaveChangesAsync();
            }
            return server.InviteCode;
        }

        public async Task<string?> GetMemberRoleAsync(int serverId, string userId)
        {
            var mapping = await _smrRepo.Query()
                .Include(smr => smr.ServerRole)
                .Include(smr => smr.ServerMember)
                .Where(smr => smr.ServerMember.ServerId == serverId && smr.ServerMember.UserId == userId)
                .OrderByDescending(smr => smr.ServerRole.Position)
                .FirstOrDefaultAsync();

            return mapping?.ServerRole?.Name ?? "Member";
        }

        public async Task<bool> SetMemberRoleAsync(int serverId, string targetUserId, string role, string requesterId)
        {
            // DEPRECATED - but kept for minimal compat until frontend fully moves to AssignRoleToMemberAsync
            return false;
        }

        public async Task<int> GetServerIdByChannelIdAsync(int channelId)
        {
            var channel = await _channelRepo.GetByIdAsync(channelId);
            return channel?.ServerId ?? 0;
        }

        public async Task<bool> SetCustomUrlAsync(int serverId, string customUrl, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageServer))
                return false;

            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return false;

            if (!string.IsNullOrEmpty(customUrl))
            {
                var existing = await _serverRepo.Query().AnyAsync(s => s.CustomUrl == customUrl && s.Id != serverId);
                if (existing) return false;
            }

            server.CustomUrl = customUrl;
            _serverRepo.Update(server);
            await _serverRepo.SaveChangesAsync();
            return true;
        }

        public async Task<object?> GetServerSettingsAsync(int serverId, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageServer))
                return null;

            var server = await _serverRepo.GetByIdAsync(serverId);
            if (server == null) return null;

            return new
            {
                name = server.Name,
                inviteCode = server.InviteCode,
                customUrl = server.CustomUrl,
                iconUrl = server.IconUrl,
                bannerUrl = server.BannerUrl
            };
        }

        public async Task<JoinViewModel?> GetServerPublicInfoAsync(string inviteCode)
        {
            var server = await _serverRepo.Query()
                .FirstOrDefaultAsync(s => s.InviteCode == inviteCode || s.CustomUrl == inviteCode);

            if (server == null) return null;

            var memberCount = await _memberRepo.Query().CountAsync(m => m.ServerId == server.Id);

            return new JoinViewModel
            {
                Id = server.Id,
                Name = server.Name,
                MemberCount = memberCount,
                CreatedAt = server.CreatedAt,
                InviteCode = inviteCode
            };
        }

        public async Task<List<Server>> GetUserServersAsync(string userId)
        {
            return await _memberRepo.Query()
                .Where(m => m.UserId == userId)
                .Include(m => m.Server)
                .Select(m => m.Server)
                .ToListAsync();
        }

        // New Role Management Implementations
        public async Task<IEnumerable<object>> GetServerRolesAsync(int serverId)
        {
            return await _roleRepo.Query()
                .Where(r => r.ServerId == serverId)
                .OrderByDescending(r => r.Position)
                .Select(r => new {
                    id = r.Id,
                    name = r.Name,
                    color = r.ColorHex,
                    position = r.Position,
                    permissions = (long)r.Permissions,
                    isDefault = r.IsDefault
                })
                .ToListAsync();
        }


        public async Task<bool> CreateRoleAsync(int serverId, string name, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageRoles))
                return false;

            var highestPos = await _authService.GetHighestRolePositionAsync(userId, serverId);
            
            var newRole = new ServerRole
            {
                ServerId = serverId,
                Name = name,
                Position = highestPos > 0 ? highestPos - 1 : 1, // Place below current highest
                Permissions = ServerPermissions.SendMessages,
                ColorHex = "#99aab5"
            };

            await _roleRepo.AddAsync(newRole);
            await _roleRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateRoleAsync(int serverId, int roleId, string name, string colorHex, ServerPermissions permissions, int position, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageRoles))
                return false;

            if (!await _authService.CanManageRoleAsync(userId, serverId, roleId))
                return false;

            var role = await _roleRepo.GetByIdAsync(roleId);
            if (role == null || role.ServerId != serverId) return false;

            // Hierarchy Safety: Cannot set position equal to or higher than your own
            var actingUserHighestPos = await _authService.GetHighestRolePositionAsync(userId, serverId);
            if (position >= actingUserHighestPos && actingUserHighestPos != int.MaxValue)
            {
                position = actingUserHighestPos - 1;
            }

            // Permission Safety: Cannot grant Administrator if you aren't an admin/owner
            var actingUserPerms = await _authService.GetUserPermissionsAsync(userId, serverId);
            if ((permissions & ServerPermissions.Administrator) == ServerPermissions.Administrator)
            {
                if ((actingUserPerms & ServerPermissions.Administrator) != ServerPermissions.Administrator)
                {
                    // Strip admin if acting user lacks it
                    permissions &= ~ServerPermissions.Administrator;
                }
            }

            role.Name = name;
            role.ColorHex = colorHex;
            role.Permissions = permissions;
            role.Position = position;

            _roleRepo.Update(role);
            await _roleRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteRoleAsync(int serverId, int roleId, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageRoles))
                return false;

            if (!await _authService.CanManageRoleAsync(userId, serverId, roleId))
                return false;

            var role = await _roleRepo.GetByIdAsync(roleId);
            if (role == null || role.ServerId != serverId || role.IsDefault) return false;

            _roleRepo.Remove(role);
            await _roleRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AssignRoleToMemberAsync(int serverId, string targetUserId, int roleId, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageRoles))
                return false;

            // Must be able to manage the role itself
            if (!await _authService.CanManageRoleAsync(userId, serverId, roleId))
                return false;

            var targetMember = await _memberRepo.Query().FirstOrDefaultAsync(m => m.ServerId == serverId && m.UserId == targetUserId);
            if (targetMember == null) return false;

            // Must also be higher than the target member's highest role
            var actingUserHighestPos = await _authService.GetHighestRolePositionAsync(userId, serverId);
            var targetMemberHighestPos = await _authService.GetHighestRolePositionAsync(targetUserId, serverId);
            
            if (actingUserHighestPos <= targetMemberHighestPos && actingUserHighestPos != int.MaxValue)
                return false;

            var exists = await _smrRepo.Query().AnyAsync(smr => smr.ServerMemberId == targetMember.Id && smr.ServerRoleId == roleId);
            if (exists) return true;

            await _smrRepo.AddAsync(new ServerMemberRole { ServerMemberId = targetMember.Id, ServerRoleId = roleId });
            await _smrRepo.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RemoveRoleFromMemberAsync(int serverId, string targetUserId, int roleId, string userId)
        {
            if (!await _authService.HasPermissionAsync(userId, serverId, ServerPermissions.ManageRoles))
                return false;

            if (!await _authService.CanManageRoleAsync(userId, serverId, roleId))
                return false;

            var targetMember = await _memberRepo.Query().FirstOrDefaultAsync(m => m.ServerId == serverId && m.UserId == targetUserId);
            if (targetMember == null) return false;

            var actingUserHighestPos = await _authService.GetHighestRolePositionAsync(userId, serverId);
            var targetMemberHighestPos = await _authService.GetHighestRolePositionAsync(targetUserId, serverId);
            
            if (actingUserHighestPos <= targetMemberHighestPos && actingUserHighestPos != int.MaxValue)
                return false;

            var mapping = await _smrRepo.Query().FirstOrDefaultAsync(smr => smr.ServerMemberId == targetMember.Id && smr.ServerRoleId == roleId);
            if (mapping == null) return true;

            _smrRepo.Remove(mapping);
            await _smrRepo.SaveChangesAsync();
            return true;
        }
    }
}