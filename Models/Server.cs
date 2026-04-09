using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace DoWeTalk.Models
{
    public class Server
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; }
        public string OwnerId { get; set; }
        public string InviteCode { get; set; }
        public string? CustomUrl { get; set; }
        public string? IconUrl { get; set; }
        public string? BannerUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<ServerMember> Members { get; set; } = new List<ServerMember>();
        public virtual ICollection<Channel> Channels { get; set; } = new List<Channel>();
    }
}
