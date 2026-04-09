using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace DoWeTalk.Models // <-- Burası çok önemli!
{
    public class ApplicationUser : IdentityUser
    {
        public string? AvatarUrl { get; set; }
        public string? BannerUrl { get; set; }

        [MaxLength(500)]
        public string? Bio { get; set; }
        
        public bool IsPlusMember { get; set; } = false;
        
        [MaxLength(30)]
        public string? Nickname { get; set; }
        
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        [MaxLength(30)]
        public string Theme { get; set; } = "theme-dark";

        [MaxLength(20)]
        public string AccentColor { get; set; } = "#5865f2";
    }
}