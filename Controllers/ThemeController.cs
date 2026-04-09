using DoWeTalk.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading.Tasks;

namespace DoWeTalk.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ThemeController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public ThemeController(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            // Always ensure theme starts with theme- and is lowercase
            var theme = user.Theme?.ToLower() ?? "theme-dark";
            if (!theme.StartsWith("theme-")) theme = "theme-dark";

            return Ok(new
            {
                theme = theme,
                accentColor = user.AccentColor ?? "#5865f2"
            });
        }

        [HttpPost("update")]
        public async Task<IActionResult> UpdateTheme([FromBody] ThemeUpdateRequest request)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            if (!string.IsNullOrEmpty(request.Theme))
            {
                var themeName = request.Theme.ToLower();
                // Expanded Whitelist for security
                var allowedThemes = new[] { 
                    "theme-dark", "theme-sakura", "theme-cyberpunk", "theme-void", 
                    "theme-glass", "theme-frost", "theme-royal-crimson", "theme-gigachad",
                    "theme-ruby", "theme-neon-rider", "theme-brutalist", "theme-hacker",
                    "theme-banana", "theme-black-gold", "theme-ice-core", "theme-sunset",
                    "theme-forest", "theme-ocean", "theme-pastel", "theme-plasma",
                    "theme-printstream", "theme-coffee", "theme-mint", "theme-dracula"
                };
                
                if (allowedThemes.Contains(themeName) || themeName.StartsWith("theme-"))
                {
                    user.Theme = themeName;
                }
            }

            if (!string.IsNullOrEmpty(request.AccentColor))
            {
                // Basic hex validation
                if (System.Text.RegularExpressions.Regex.IsMatch(request.AccentColor, "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"))
                {
                    user.AccentColor = request.AccentColor;
                }
            }

            var result = await _userManager.UpdateAsync(user);
            if (result.Succeeded)
            {
                return Ok(new { success = true });
            }

            return BadRequest(result.Errors);
        }
    }

    public class ThemeUpdateRequest
    {
        public string Theme { get; set; }
        public string AccentColor { get; set; }
    }
}
