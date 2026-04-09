using DoWeTalk.Data.Repositories;
using DoWeTalk.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace DoWeTalk.Services
{
    public class UserService : IUserService
    {
        private readonly IRepository<Friendship> _friendRepo;
        private readonly IRepository<BlockedUser> _blockRepo;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IPresenceService _presenceService;

        public UserService(
            IRepository<Friendship> friendRepo, 
            IRepository<BlockedUser> blockRepo, 
            UserManager<ApplicationUser> userManager,
            IPresenceService presenceService)
        {
            _friendRepo = friendRepo;
            _blockRepo = blockRepo;
            _userManager = userManager;
            _presenceService = presenceService;
        }

        public async Task<bool> SendFriendRequestAsync(string senderId, string targetId)
        {
            if (senderId == targetId) return false;

            var isBlocked = await _blockRepo.Query().AnyAsync(b => 
                (b.BlockerId == senderId && b.BlockedId == targetId) || 
                (b.BlockerId == targetId && b.BlockedId == senderId));
            
            if (isBlocked) return false;

            var exists = await _friendRepo.Query().AnyAsync(f =>
                (f.User1Id == senderId && f.User2Id == targetId) ||
                (f.User1Id == targetId && f.User2Id == senderId));

            if (exists) return false;

            await _friendRepo.AddAsync(new Friendship
            {
                User1Id = senderId,
                User2Id = targetId,
                IsAccepted = false
            });
            await _friendRepo.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<object>> GetPendingRequestsAsync(string userId)
        {
            return await _friendRepo.Query()
                .Include(f => f.User1)
                .Where(f => f.User2Id == userId && !f.IsAccepted)
                .Select(f => new {
                    requestId = f.Id,
                    senderName = f.User1.UserName ?? "Bilinmeyen Kullanıcı"
                })
                .ToListAsync();
        }

        public async Task<bool> RespondFriendRequestAsync(int requestId, string currentUserId, bool accept)
        {
            var friendship = await _friendRepo.GetByIdAsync(requestId);
            if (friendship == null || friendship.User2Id != currentUserId) return false;

            if (accept)
            {
                friendship.IsAccepted = true;
                _friendRepo.Update(friendship);
            }
            else
            {
                _friendRepo.Remove(friendship);
            }
            await _friendRepo.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<object>> GetFriendsAsync(string userId)
        {
            var friendships = await _friendRepo.Query()
                .Include(f => f.User1)
                .Include(f => f.User2)
                .Where(f => (f.User1Id == userId || f.User2Id == userId) && f.IsAccepted)
                .ToListAsync();

            var result = new List<object>();
            foreach (var f in friendships)
            {
                var friend = f.User1Id == userId ? f.User2 : f.User1;
                bool isOnline = await _presenceService.IsUserOnlineAsync(friend.Id);
                result.Add(new
                {
                    UserId = friend.Id,
                    Username = friend.UserName,
                    Nickname = friend.Nickname,
                    AvatarUrl = friend.AvatarUrl,
                    IsOnline = isOnline 
                });
            }
            return result;
        }

        public async Task<bool> BlockUserAsync(string blockerId, string blockedId)
        {
            if (blockerId == blockedId) return false;

            var exists = await _blockRepo.Query().AnyAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId);
            if (exists) return false;

            await _blockRepo.AddAsync(new BlockedUser { BlockerId = blockerId, BlockedId = blockedId });
            await _blockRepo.SaveChangesAsync();

            // Sadece bloğu ekledikten sonra arkadaşlıkları da silebiliriz.
            var friendships = await _friendRepo.Query()
                .Where(f => (f.User1Id == blockerId && f.User2Id == blockedId) || 
                            (f.User1Id == blockedId && f.User2Id == blockerId))
                .ToListAsync();

            foreach(var friendship in friendships)
            {
                _friendRepo.Remove(friendship);
            }
            await _friendRepo.SaveChangesAsync();

            return true;
        }

        public async Task<bool> UnblockUserAsync(string blockerId, string blockedId)
        {
            var block = await _blockRepo.Query()
                .FirstOrDefaultAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId);
            
            if (block == null) return false;

            _blockRepo.Remove(block);
            await _blockRepo.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<object>> GetBlockedUsersAsync(string userId)
        {
            return await _blockRepo.Query()
                .Include(b => b.Blocked)
                .Where(b => b.BlockerId == userId)
                .Select(b => new {
                    username = b.Blocked.UserName,
                    nickname = b.Blocked.Nickname,
                    blockedAt = b.BlockedAt
                })
                .ToListAsync();
        }

        public async Task<int> GetPendingRequestCountAsync(string userId)
        {
            return await _friendRepo.Query()
                .CountAsync(f => f.User2Id == userId && !f.IsAccepted);
        }

        public async Task<List<string>> GetFriendIdsAsync(string userId)
        {
            var friendships = await _friendRepo.Query()
                .Where(f => (f.User1Id == userId || f.User2Id == userId) && f.IsAccepted)
                .ToListAsync();

            return friendships.Select(f => f.User1Id == userId ? f.User2Id : f.User1Id).Distinct().ToList();
        }

        public async Task<bool> UpdateProfileAsync(string userId, string bio, string avatarUrl, string? nickname = null)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return false;

            if (bio != null) user.Bio = bio;
            if (avatarUrl != null) user.AvatarUrl = avatarUrl;
            if (nickname != null) user.Nickname = nickname;
            
            var result = await _userManager.UpdateAsync(user);
            return result.Succeeded;
        }
    }
}
