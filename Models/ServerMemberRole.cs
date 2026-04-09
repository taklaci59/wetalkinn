using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class ServerMemberRole
    {
        [Key]
        public int Id { get; set; }

        public int ServerMemberId { get; set; }
        [ForeignKey("ServerMemberId")]
        public virtual ServerMember ServerMember { get; set; }

        public int ServerRoleId { get; set; }
        [ForeignKey("ServerRoleId")]
        public virtual ServerRole ServerRole { get; set; }
    }
}
