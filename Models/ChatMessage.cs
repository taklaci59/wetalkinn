using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class ChatMessage
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Content { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public string SenderId { get; set; }
        [ForeignKey("SenderId")]
        public virtual ApplicationUser Sender { get; set; }

        // Alıcı bir kullanıcı olabilir (Özel Mesaj)
        public string? ReceiverId { get; set; }
        [ForeignKey("ReceiverId")]
        public virtual ApplicationUser? Receiver { get; set; }

        // --- DÜZELTİLEN KISIM ---
        // Channel.Id int olduğu için burası da int? olmalı
        public int? ChannelId { get; set; }
        [ForeignKey("ChannelId")]
        public virtual Channel? Channel { get; set; }
    }
}
