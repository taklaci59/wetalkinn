using System;

namespace DoWeTalk.Models
{
    public class JoinViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int MemberCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public string InviteCode { get; set; } = string.Empty;
    }
}
