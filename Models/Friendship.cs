// Models/Friendship.cs
using DoWeTalk.Models;

public class Friendship
{
    public int Id { get; set; }
    public string User1Id { get; set; } // İsteği gönderen
    public string User2Id { get; set; } // Kabul eden
   
    public bool IsAccepted { get; set; } = false;
    public virtual ApplicationUser User1 { get; set; }
    public virtual ApplicationUser User2 { get; set; }
}