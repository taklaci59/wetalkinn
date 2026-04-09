using System.Text.RegularExpressions;
using DoWeTalk.Data.Repositories;
using DoWeTalk.Models;
using Microsoft.EntityFrameworkCore;

namespace DoWeTalk.Services
{
    public class ChatService : IChatService
    {
        private readonly IRepository<ChatMessage> _messageRepo;
        private readonly IServerService _serverService;
        private readonly IAuthorizationService _authService;

        public ChatService(IRepository<ChatMessage> messageRepo, IServerService serverService, IAuthorizationService authService)
        {
            _messageRepo = messageRepo;
            _serverService = serverService;
            _authService = authService;
        }

        public async Task<ChatMessage> SaveChannelMessageAsync(int channelId, string senderId, string content)
        {
            var serverId = await _serverService.GetServerIdByChannelIdAsync(channelId);
            if (serverId == 0) throw new ArgumentException("Kanal bulunamadı.");

            // 1. Permission Check: SendMessages
            if (!await _authService.HasPermissionAsync(senderId, serverId, ServerPermissions.SendMessages))
            {
                throw new UnauthorizedAccessException("Mesaj gönderme yetkiniz yok.");
            }

            // 2. Mention Check: @everyone (Robust Regex)
            var everyoneRegex = new Regex(@"(?i)(?<=^|[\s.,!?;])@everyone(?=[\s.,!?;]|$)", RegexOptions.Compiled);
            if (everyoneRegex.IsMatch(content))
            {
                if (!await _authService.HasPermissionAsync(senderId, serverId, ServerPermissions.MentionEveryone))
                {
                    // Block the message if the user doesn't have the permission
                    throw new UnauthorizedAccessException("Herkesten bahsetme yetkiniz yok.");
                }
            }

            var msg = new ChatMessage
            {
                ChannelId = channelId,
                SenderId = senderId,
                Content = content,
                Timestamp = DateTime.UtcNow
            };
            await _messageRepo.AddAsync(msg);
            await _messageRepo.SaveChangesAsync();
            return msg;
        }

        public async Task<ChatMessage> SavePrivateMessageAsync(string senderId, string receiverId, string content)
        {
            var msg = new ChatMessage
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = content,
                Timestamp = DateTime.UtcNow
            };
            await _messageRepo.AddAsync(msg);
            await _messageRepo.SaveChangesAsync();
            return msg;
        }

        public async Task<IEnumerable<object>> GetChannelMessagesAsync(int channelId, int skip, int take)
        {
            return await _messageRepo.Query()
                .Include(m => m.Sender)
                .Where(m => m.ChannelId == channelId)
                .OrderByDescending(m => m.Timestamp)
                .Skip(skip)
                .Take(take)
                .Select(m => new {
                    sender = m.Sender.UserName,
                    content = m.Content,
                    time = m.Timestamp.ToString("HH:mm")
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<object>> GetPrivateMessagesAsync(string userId, string otherUserId, int skip, int take)
        {
            return await _messageRepo.Query()
                .Include(m => m.Sender)
                .Where(m => (m.SenderId == userId && m.ReceiverId == otherUserId) ||
                            (m.SenderId == otherUserId && m.ReceiverId == userId))
                .OrderByDescending(m => m.Timestamp)
                .Skip(skip)
                .Take(take)
                .Select(m => new {
                    sender = m.Sender.UserName,
                    content = m.Content,
                    time = m.Timestamp.ToString("HH:mm")
                })
                .ToListAsync();
        }
    }
}
