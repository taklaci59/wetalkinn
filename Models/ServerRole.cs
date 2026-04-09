using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class ServerRole
    {
        [Key]
        public int Id { get; set; }

        public int ServerId { get; set; }
        [ForeignKey("ServerId")]
        public virtual Server Server { get; set; }

        [Required]
        [MaxLength(64)]
        public string Name { get; set; } // e.g. "@everyone", "Admin", "Mod"

        [MaxLength(7)]
        public string ColorHex { get; set; } // e.g. "#FF0000"

        public int Position { get; set; } // Hierarchy: lower number = lower power (or higher=higher power). 0 = @everyone.

        public ServerPermissions Permissions { get; set; }

        public bool IsDefault { get; set; } // True if this is the undeletable @everyone role

        public virtual ICollection<ServerMemberRole> MemberRoles { get; set; } = new List<ServerMemberRole>();
    }
}
