using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class BlockedUser
    {
        [Key]
        public int Id { get; set; }
        
        public string BlockerId { get; set; } = null!;
        [ForeignKey("BlockerId")]
        public virtual ApplicationUser Blocker { get; set; } = null!;
        
        public string BlockedId { get; set; } = null!;
        [ForeignKey("BlockedId")]
        public virtual ApplicationUser Blocked { get; set; } = null!;
        
        public DateTime BlockedAt { get; set; } = DateTime.UtcNow;
    }
}
