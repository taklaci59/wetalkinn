using DoWeTalk.Models;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class ServerMember
    {
        [Key]
        public int Id { get; set; }

        public int ServerId { get; set; }

        [ForeignKey("ServerId")]
        public virtual Server Server { get; set; }

        public string UserId { get; set; }
        [ForeignKey("UserId")]
        public virtual ApplicationUser User { get; set; }
    }
}