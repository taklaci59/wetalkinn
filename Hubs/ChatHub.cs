using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using DoWeTalk.Data.Repositories;
using DoWeTalk.Services;
using DoWeTalk.Models;

namespace DoWeTalk.Hubs
{
    public class ChatHub : Hub<IChatClient>
    {
        private readonly IUserService _userService;
        private readonly IChatService _chatService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IPresenceService _presenceService;
        private readonly DoWeTalk.Services.IAuthorizationService _authService;
        private readonly IServerService _serverService;

        public ChatHub(
            IUserService userService, 
            IChatService chatService, 
            UserManager<ApplicationUser> userManager, 
            IPresenceService presenceService,
            DoWeTalk.Services.IAuthorizationService authService,
            IServerService serverService)
        {
            _userService = userService;
            _chatService = chatService;
            _userManager = userManager;
            _presenceService = presenceService;
            _authService = authService;
            _serverService = serverService;
        }

        public override async Task OnConnectedAsync()
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                bool isFirstConnection = await _presenceService.UserConnectedAsync(user.Id, Context.ConnectionId);

                // Server groups for presence broadcast
                var userServers = await _serverService.GetUserServersAsync(user.Id);
                foreach (var server in userServers)
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, $"ServerGroup_{server.Id}");
                    if (isFirstConnection)
                    {
                        await Clients.Group($"ServerGroup_{server.Id}").UserStatusChanged(user.Id, true);
                    }
                }

                if (isFirstConnection)
                {
                    var friendIds = await _userService.GetFriendIdsAsync(user.Id);
                    if (friendIds.Any())
                    {
                        await Clients.Users(friendIds).UserStatusChanged(user.Id, true);
                    }
                }
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                bool isLastConnection = await _presenceService.UserDisconnectedAsync(user.Id, Context.ConnectionId);
                
                if (isLastConnection)
                {
                    var userServers = await _serverService.GetUserServersAsync(user.Id);
                    foreach (var server in userServers)
                    {
                        await Clients.Group($"ServerGroup_{server.Id}").UserStatusChanged(user.Id, false);
                    }

                    var friendIds = await _userService.GetFriendIdsAsync(user.Id);
                    if (friendIds.Any())
                    {
                        await Clients.Users(friendIds).UserStatusChanged(user.Id, false);
                    }
                    
                    // Clear Voice Presence
                    await _presenceService.RemoveVoiceChannelPresenceAsync(user.Id);
                }
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendCallRequest(string targetUsername)
        {
            var senderName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(senderName)) return;

            var targetUser = await _userManager.FindByNameAsync(targetUsername);
            var senderUser = await _userManager.FindByNameAsync(senderName);
            if (targetUser != null && senderUser != null)
            {
                if (await _authService.CanSendMessageAsync(senderUser.Id, targetUser.Id))
                {
                    await Clients.User(targetUser.Id).ReceiveCall(senderName);
                }
            }
        }

        public async Task AcceptCallRequest(string callerUsername)
        {
            var acceptorName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(acceptorName)) return;

            var callerUser = await _userManager.FindByNameAsync(callerUsername);
            if (callerUser != null)
                await Clients.User(callerUser.Id).CallAccepted(acceptorName);
        }

        public async Task SendOffer(string targetUsername, object offer)
        {
            var senderName = Context.User?.Identity?.Name;
            if (senderName == null) return;
            var targetUser = await _userManager.FindByNameAsync(targetUsername);
            var senderUser = await _userManager.FindByNameAsync(senderName);

            if (targetUser != null && senderUser != null && await _authService.CanSendMessageAsync(senderUser.Id, targetUser.Id))
                await Clients.User(targetUser.Id).ReceiveOffer(senderName, offer);
        }

        public async Task SendAnswer(string targetUsername, object answer)
        {
            var senderName = Context.User?.Identity?.Name;
            if (senderName == null) return;
            var targetUser = await _userManager.FindByNameAsync(targetUsername);
            var senderUser = await _userManager.FindByNameAsync(senderName);

            if (targetUser != null && senderUser != null && await _authService.CanSendMessageAsync(senderUser.Id, targetUser.Id))
                await Clients.User(targetUser.Id).ReceiveAnswer(senderName, answer);
        }

        public async Task SendIceCandidate(string targetUsername, object candidate)
        {
            var senderName = Context.User?.Identity?.Name;
            if (senderName == null) return;
            var targetUser = await _userManager.FindByNameAsync(targetUsername);
            var senderUser = await _userManager.FindByNameAsync(senderName);

            if (targetUser != null && senderUser != null && await _authService.CanSendMessageAsync(senderUser.Id, targetUser.Id))
                await Clients.User(targetUser.Id).ReceiveIceCandidate(senderName, candidate);
        }

        public async Task DeclineOrEndCall(string targetUsername)
        {
            var senderName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(senderName)) return;

            var targetUser = await _userManager.FindByNameAsync(targetUsername);
            if (targetUser != null)
                await Clients.User(targetUser.Id).CallEnded(senderName);
        }

        public async Task ToggleMedia(string targetUsername, bool micMuted, bool deafened)
        {
            var senderName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(senderName)) return;
            var targetUser = await _userManager.FindByNameAsync(targetUsername);
            var senderUser = await _userManager.FindByNameAsync(senderName);

            if (targetUser != null && senderUser != null && await _authService.CanSendMessageAsync(senderUser.Id, targetUser.Id))
                await Clients.User(targetUser.Id).ReceiveMediaStatus(senderName, micMuted, deafened);
        }

        public async Task JoinVoiceChannel(string channelId)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return;

            if (int.TryParse(channelId, out int cId))
            {
                var serverId = await _serverService.GetServerIdByChannelIdAsync(cId);
                if (serverId > 0)
                {
                    // Add to SignalR group for voice-specific updates (if needed)
                    await Groups.AddToGroupAsync(Context.ConnectionId, $"VoiceChannel_{channelId}");
                    
                    // Update occupancy tracking
                    await _presenceService.UpdateVoiceChannelPresenceAsync(user.Id, cId);
                    
                    // Broadcast to the whole server so sidebar updates for everyone
                    await Clients.Group($"ServerGroup_{serverId}").UserJoinedVoice(user.Id, user.UserName!, channelId);
                }
            }
        }

        public async Task LeaveVoiceChannel(string channelId)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return;

            if (int.TryParse(channelId, out int cId))
            {
                var serverId = await _serverService.GetServerIdByChannelIdAsync(cId);
                if (serverId > 0)
                {
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"VoiceChannel_{channelId}");
                    await _presenceService.RemoveVoiceChannelPresenceAsync(user.Id);
                    await Clients.Group($"ServerGroup_{serverId}").UserLeftVoice(user.Id, channelId);
                }
            }
        }
        public async Task JoinServerGroup(string channelId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, channelId);
        }

        public async Task StartScreenShare(string channelId)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return;
            
            // Broadcast to the voice channel group
            await Clients.Group($"VoiceChannel_{channelId}").ReceiveScreenShareStart(user.UserName!);
        }

        public async Task StopScreenShare(string channelId)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return;
            
            // Broadcast to the voice channel group
            await Clients.Group($"VoiceChannel_{channelId}").ReceiveScreenShareStop(user.UserName!);
        }

        public async Task SendFriendRequest(string receiverUsername)
        {
            var senderName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(senderName) || senderName == receiverUsername) return;

            var sender = await _userManager.FindByNameAsync(senderName);
            var receiver = await _userManager.FindByNameAsync(receiverUsername);

            if (sender == null || receiver == null) return;

            var success = await _userService.SendFriendRequestAsync(sender.Id, receiver.Id);
            if (success)
            {
                await Clients.User(receiver.Id).ReceiveFriendRequest(senderName);
            }
        }

        public async Task SendMessage(string receiverUsername, string message)
        {
            var senderName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(senderName) || string.IsNullOrEmpty(message)) return;

            var sender = await _userManager.FindByNameAsync(senderName);
            var receiver = await _userManager.FindByNameAsync(receiverUsername);

            if (sender != null && receiver != null)
            {
                // CRITICAL FIX: Direct repository access removed, authorization enforced.
                if (await _authService.CanSendMessageAsync(sender.Id, receiver.Id))
                {
                    var chatMessage = await _chatService.SavePrivateMessageAsync(sender.Id, receiver.Id, message);
                    await Clients.Users(sender.Id, receiver.Id).ReceivePrivateMessage(senderName, receiverUsername, message, chatMessage.Timestamp.ToString("HH:mm"));
                }
            }
        }

        public async Task SendTypingStatus(string receiverUsername, bool isTyping)
        {
            var senderName = Context.User?.Identity?.Name;
            if (string.IsNullOrEmpty(senderName)) return;

            var receiver = await _userManager.FindByNameAsync(receiverUsername);
            if (receiver != null)
                await Clients.User(receiver.Id).ReceiveTypingStatus(senderName, isTyping);
        }
    }
}
