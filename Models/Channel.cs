using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoWeTalk.Models
{
    public class Channel
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; }
        public int ServerId { get; set; }

        [ForeignKey("ServerId")]
        public virtual Server Server { get; set; }
        
        public int? CategoryId { get; set; }
        [ForeignKey("CategoryId")]
        public virtual Category? Category { get; set; }

        public bool IsVoice { get; set; } = false; // Sesli kanal desteği için
    }
}