using DoWeTalk.Models;
using DoWeTalk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace DoWeTalk.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class RoleController : ControllerBase
    {
        private readonly IServerService _serverService;
        private readonly UserManager<ApplicationUser> _userManager;

        public RoleController(IServerService serverService, UserManager<ApplicationUser> userManager)
        {
            _serverService = serverService;
            _userManager = userManager;
        }

        [HttpGet("{serverId}")]
        public async Task<IActionResult> GetRoles(int serverId)
        {
            var roles = await _serverService.GetServerRolesAsync(serverId);
            return Ok(roles);
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateRole(int serverId, string name)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.CreateRoleAsync(serverId, name, user.Id);
            if (!success) return Forbid();

            return Ok(new { success = true });
        }

        [HttpPost("update")]
        public async Task<IActionResult> UpdateRole(int serverId, int roleId, string name, string colorHex, long permissions, int position)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.UpdateRoleAsync(serverId, roleId, name, colorHex, (ServerPermissions)permissions, position, user.Id);
            if (!success) return Forbid();

            return Ok(new { success = true });
        }

        [HttpDelete("{serverId}/{roleId}")]
        public async Task<IActionResult> DeleteRole(int serverId, int roleId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.DeleteRoleAsync(serverId, roleId, user.Id);
            if (!success) return Forbid();

            return Ok(new { success = true });
        }

        [HttpPost("assign")]
        public async Task<IActionResult> AssignRole(int serverId, string targetUserId, int roleId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.AssignRoleToMemberAsync(serverId, targetUserId, roleId, user.Id);
            if (!success) return Forbid();

            return Ok(new { success = true });
        }

        [HttpPost("remove")]
        public async Task<IActionResult> RemoveRole(int serverId, string targetUserId, int roleId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var success = await _serverService.RemoveRoleFromMemberAsync(serverId, targetUserId, roleId, user.Id);
            if (!success) return Forbid();

            return Ok(new { success = true });
        }
    }
}
