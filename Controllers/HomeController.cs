using DoWeTalk.Models;
using DoWeTalk.Services;
using DoWeTalk.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace DoWeTalk.Controllers
{
    public class HomeController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IServerService _serverService;
        private readonly IChatService _chatService;
        private readonly DoWeTalk.Services.IAuthorizationService _authService;
        private readonly IMetadataService _metadataService;
        private readonly IPresenceService _presenceService;

        public HomeController(
            UserManager<ApplicationUser> userManager,
            IHubContext<ChatHub> hubContext,
            IServerService serverService,
            IChatService chatService,
            DoWeTalk.Services.IAuthorizationService authService,
            IMetadataService metadataService,
            IPresenceService presenceService)
        {
            _userManager = userManager;
            _hubContext = hubContext;
            _serverService = serverService;
            _chatService = chatService;
            _authService = authService;
            _metadataService = metadataService;
            _presenceService = presenceService;
        }

        public IActionResult Index() => View();

        [Authorize]
        public async Task<IActionResult> Dashboard()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Auth", "Account");

            ViewBag.UserServers = await _serverService.GetUserServersAsync(user.Id);

            return View(user);
        }

        public IActionResult Privacy() => View();

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error() => View(new ErrorViewModel { RequestId = System.Diagnostics.Activity.Current?.Id ?? HttpContext.TraceIdentifier });

        // --- MESAJ SISTEMI ---
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> SendMessage(int channelId, int serverId, string content)
        {
            var user = await _userManager.GetUserAsync(User);
            if (string.IsNullOrEmpty(content) || user == null) return Json(new { success = false });

            if (serverId == 0)
            {
                serverId = await _serverService.GetServerIdByChannelIdAsync(channelId);
            }

            if (!await _authService.HasServerRoleAsync(user.Id, serverId)) return Unauthorized();

            try
            {
                var message = await _chatService.SaveChannelMessageAsync(channelId, user.Id, content);

                var members = await _serverService.GetServerMembersAsync(serverId);
                var memberUsernames = members
                    .Select(m => (string?)m.GetType().GetProperty("username")?.GetValue(m, null)
                              ?? (string?)m.GetType().GetProperty("Username")?.GetValue(m, null))
                    .Where(n => !string.IsNullOrEmpty(n))
                    .ToList();

                var candidateUserIds = new List<string>();
                foreach (var mName in memberUsernames)
                {
                    if (mName == user.UserName) continue;
                    var mUser = await _userManager.FindByNameAsync(mName!);
                    if (mUser != null) candidateUserIds.Add(mUser.Id);
                }

                var validUserIds = await _authService.FilterBlockedUsersAsync(user.Id, candidateUserIds);
                validUserIds.Add(user.Id);

                await _hubContext.Clients.Users(validUserIds)
                    .SendAsync("ReceiveMessage", user.UserName, content, channelId.ToString());

                return Json(new { success = true });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
            catch (Exception)
            {
                return Json(new { success = false, message = "Mesaj gönderilirken bir hata oluştu." });
            }
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetChannelMessages(int channelId, int serverId, int skip = 0, int take = 50)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            if (serverId == 0)
            {
                serverId = await _serverService.GetServerIdByChannelIdAsync(channelId);
            }

            if (!await _authService.HasServerRoleAsync(user.Id, serverId)) return Unauthorized();

            var messages = await _chatService.GetChannelMessagesAsync(channelId, skip, take);
            return Json(messages.Reverse());
        }

        // --- SUNUCU SISTEMI ---
        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> CreateServer(string name)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 32)
                return Json(new { success = false, message = "Sunucu ismi 2-32 karakter arasında olmalıdır." });

            var server = await _serverService.CreateServerAsync(name, user.Id);

            var channels = await _serverService.GetChannelsAsync(server.Id);
            var defaultChannel = channels.FirstOrDefault();
            var defaultChannelId = defaultChannel?.GetType().GetProperty("id")?.GetValue(defaultChannel, null);

            return Json(new
            {
                success = true,
                serverId = server.Id,
                serverName = server.Name,
                defaultChannelId = defaultChannelId
            });
        }



        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> JoinServer(string inviteCode)
        {
            var user = await _userManager.GetUserAsync(User);
            var success = await _serverService.JoinServerAsync(inviteCode, user!.Id);
            return Json(new { success = success, message = success ? "" : "Gecersiz kod veya zaten uyesiniz." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> SetServerCustomUrl(int serverId, string customUrl)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.SetCustomUrlAsync(serverId, customUrl, user.Id);
            return Json(new { success, customUrl = customUrl, message = success ? "Özel URL başarıyla güncellendi!" : "Bu URL zaten kullanımda veya yetkiniz yok." });
        }

        [HttpGet("{vanity}")]
        [Authorize]
        public async Task<IActionResult> JoinCustom(string vanity)
        {
            string[] reserved = { "Dashboard", "Privacy", "Index", "Account", "Error", "Chat" };
            if (reserved.Any(r => r.Equals(vanity, StringComparison.OrdinalIgnoreCase)))
            {
                return RedirectToAction(vanity);
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return RedirectToAction("Auth", "Account");

            var serverInfo = await _serverService.GetServerPublicInfoAsync(vanity);
            if (serverInfo == null)
            {
                return RedirectToAction("Dashboard");
            }

            return View("Join", serverInfo);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> JoinServerFinal(string inviteCode)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.JoinServerAsync(inviteCode, user.Id);
            if (success)
            {
                return RedirectToAction("Dashboard");
            }

            ViewBag.Error = "Sunucuya katılamadınız. Zaten üye olabilirsiniz veya kod geçersizdir.";
            var serverInfo = await _serverService.GetServerPublicInfoAsync(inviteCode);
            return View("Join", serverInfo);
        }

        [HttpGet("api/invite/{code}")]
        [Authorize]
        public async Task<IActionResult> GetInviteInfo(string code)
        {
            var info = await _serverService.GetServerPublicInfoAsync(code);
            if (info == null) return NotFound();
            return Json(info);
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetServerSettings(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var settings = await _serverService.GetServerSettingsAsync(serverId, user.Id);
            if (settings == null) return Unauthorized();

            return Json(settings);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> LeaveServer(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            var success = await _serverService.LeaveServerAsync(serverId, user!.Id);
            return Json(new { success = success, message = success ? "" : "Uyelik bulunamadi." });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetMemberRole(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var role = await _serverService.GetMemberRoleAsync(serverId, user.Id);
            return Json(new { role = role });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetChannels(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null || !await _authService.HasServerRoleAsync(user.Id, serverId)) return Unauthorized();

            var channels = await _serverService.GetChannelsAsync(serverId);
            
            // Augment with occupancy data for voice channels
            var result = new List<object>();
            foreach (var ch in channels)
            {
                var channelObj = new Dictionary<string, object>();
                // Extract properties from the anonymous/dynamic object returned by the service
                foreach (var prop in ch.GetType().GetProperties())
                {
                    channelObj[prop.Name] = prop.GetValue(ch, null);
                }

                if ((bool)channelObj["isVoice"])
                {
                    var occupants = await _presenceService.GetChannelOccupantsAsync((int)channelObj["id"]);
                    var occupantNames = new List<string>();
                    foreach (var uId in occupants)
                    {
                        var u = await _userManager.FindByIdAsync(uId);
                        if (u != null) occupantNames.Add(u.UserName!);
                    }
                    channelObj["occupants"] = occupantNames;
                }
                result.Add(channelObj);
            }
            
            return Json(result);
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetCategories(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null || !await _authService.HasServerRoleAsync(user.Id, serverId)) return Unauthorized();

            var categories = await _serverService.GetCategoriesAsync(serverId);
            return Json(categories);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> CreateChannel(int serverId, string name, bool isVoice, int? categoryId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.CreateChannelAsync(serverId, name, user.Id, isVoice, categoryId);
            return Json(new { success, message = success ? "Kanal oluşturuldu." : "Yetkiniz yok." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> UpdateChannel(int serverId, int channelId, string name, bool isVoice, int? categoryId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.UpdateChannelAsync(serverId, channelId, name, user.Id, isVoice, categoryId);
            return Json(new { success, message = success ? "Kanal güncellendi." : "Yetkiniz yok." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> DeleteChannel(int serverId, int channelId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.DeleteChannelAsync(serverId, channelId, user.Id);
            return Json(new { success, message = success ? "Kanal silindi." : "Yetkiniz yok." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> CreateCategory(int serverId, string name)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.CreateCategoryAsync(serverId, name, user.Id);
            return Json(new { success, message = success ? "Kategori oluşturuldu." : "Yetkiniz yok." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> UpdateCategory(int serverId, int categoryId, string name)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.UpdateCategoryAsync(serverId, categoryId, name, user.Id);
            return Json(new { success, message = success ? "Kategori güncellendi." : "Yetkiniz yok." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> DeleteCategory(int serverId, int categoryId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.DeleteCategoryAsync(serverId, categoryId, user.Id);
            return Json(new { success, message = success ? "Kategori silindi." : "Yetkiniz yok." });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> UpdateServerProfile(int serverId, string name, string? iconUrl, string? bannerUrl)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.UpdateServerProfileAsync(serverId, name, iconUrl, bannerUrl, user.Id);
            return Json(new { success, message = success ? "Sunucu profili güncellendi." : "Yetkiniz yok." });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetServerMembers(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null || !await _authService.HasServerRoleAsync(user.Id, serverId)) return Unauthorized();

            var members = await _serverService.GetServerMembersAsync(serverId);
            return Json(members);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        [Authorize]
        public async Task<IActionResult> GenerateInviteCode(int serverId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null || !await _authService.HasPermissionAsync(user.Id, serverId, ServerPermissions.ManageServer)) return Unauthorized();

            var code = await _serverService.GenerateInviteCodeAsync(serverId);
            if (code == null) return Json(new { success = false });
            return Json(new { success = true, inviteCode = code });
        }

        [HttpPost("api/join/{code}")]
        [Authorize]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> JoinServerApi(string code)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.JoinServerAsync(code, user.Id);
            return Json(new { success = success, message = success ? "Sunucuya katıldınız!" : "Zaten üyesiniz veya geçersiz kod." });
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetMetadata(string url)
        {
            if (string.IsNullOrEmpty(url)) return BadRequest();
            var metadata = await _metadataService.GetMetadataAsync(url);
            if (metadata == null) return NotFound();
            return Json(metadata);
        }
    }
}