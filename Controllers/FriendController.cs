using DoWeTalk.Models;
using DoWeTalk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using DoWeTalk.Hubs;

namespace DoWeTalk.Controllers
{
    [Authorize]
    public class FriendController : Controller
    {
        private readonly IUserService _userService;
        private readonly IChatService _chatService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly DoWeTalk.Services.IAuthorizationService _authService;
        private readonly IHubContext<ChatHub> _hubContext;

        public FriendController(
            IUserService userService, 
            IChatService chatService, 
            UserManager<ApplicationUser> userManager,
            DoWeTalk.Services.IAuthorizationService authService,
            IHubContext<ChatHub> hubContext)
        {
            _userService = userService;
            _chatService = chatService;
            _userManager = userManager;
            _authService = authService;
            _hubContext = hubContext;
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SendRequest(string targetUsername)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            var targetUser = await _userManager.FindByNameAsync(targetUsername);

            if (targetUser == null || currentUser == null || currentUser.Id == targetUser.Id)
                return Json(new { success = false, message = "Kullanici bulunamadi veya kendinize istek gonderemezsiniz." });

            var success = await _userService.SendFriendRequestAsync(currentUser.Id, targetUser.Id);
            
            if (success)
            {
                // Notify target user
                await _hubContext.Clients.User(targetUser.Id).SendAsync("ReceiveFriendRequest", currentUser.UserName);
            }

            return Json(new { success = success, message = success ? "" : "Zaten bir istek mevcut veya arkadassiniz." });
        }

        [HttpGet]
        public async Task<IActionResult> GetPendingRequestCount()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var count = await _userService.GetPendingRequestCountAsync(user.Id);
            return Json(count);
        }

        [HttpGet]
        public async Task<IActionResult> GetPendingRequests()
        {
            var user = await _userManager.GetUserAsync(User);
            var requests = await _userService.GetPendingRequestsAsync(user!.Id);
            return Json(requests);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RespondFriendRequest(int requestId, bool accept)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var success = await _userService.RespondFriendRequestAsync(requestId, currentUser.Id, accept);
            
            if (success && accept)
            {

                // In a real app we'd get the other user ID from the friendship record.
                // For now, let's assume we notify the UI to refresh.
                // Using a generic status change or friend update event.
                await _hubContext.Clients.User(currentUser!.Id).SendAsync("UserStatusChanged", currentUser.UserName, true);
            }

            return Json(new { success = success });
        }

        [HttpGet]
        public async Task<IActionResult> GetFriends()
        {
            var currentUser = await _userManager.GetUserAsync(User);
            var friendsList = await _userService.GetFriendsAsync(currentUser!.Id);
            return Json(friendsList);
        }

        [HttpGet]
        public async Task<IActionResult> GetChatHistory(string withUser, int skip = 0, int take = 50)
        {
            if (string.IsNullOrEmpty(withUser)) return BadRequest("Kullanici adi bos olamaz.");

            var currentUser = await _userManager.GetUserAsync(User);
            var otherUser = await _userManager.FindByNameAsync(withUser);

            if (currentUser == null || otherUser == null) return BadRequest("Kullanici bulunamadi.");

            if (!await _authService.AreFriendsAsync(currentUser.Id, otherUser.Id)) 
                return Unauthorized("Bu kullanici ile arkadas degilsiniz.");

            var messages = await _chatService.GetPrivateMessagesAsync(currentUser.Id, otherUser.Id, skip, take);
            return Json(messages.Reverse());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> BlockUser(string targetUsername)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            var targetUser = await _userManager.FindByNameAsync(targetUsername);

            if (targetUser == null || currentUser == null || currentUser.Id == targetUser.Id)
                return Json(new { success = false, message = "Geçersiz işlem." });

            var success = await _userService.BlockUserAsync(currentUser.Id, targetUser.Id);
            return Json(new { success = success });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UnblockUser(string targetUsername)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            var targetUser = await _userManager.FindByNameAsync(targetUsername);

            if (targetUser == null || currentUser == null)
                return Json(new { success = false });

            var success = await _userService.UnblockUserAsync(currentUser.Id, targetUser.Id);
            return Json(new { success = success });
        }

        [HttpGet]
        public async Task<IActionResult> GetBlockedUsers()
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();

            var blocked = await _userService.GetBlockedUsersAsync(currentUser.Id);
            return Json(blocked);
        }
    }
}
