using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class Category
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(32)]
        public string Name { get; set; }
        
        public int ServerId { get; set; }
        
        [ForeignKey("ServerId")]
        public virtual Server Server { get; set; }
        
        public int Order { get; set; } = 0;

        public virtual ICollection<Channel> Channels { get; set; } = new List<Channel>();
    }
}
