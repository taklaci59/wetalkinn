using DoWeTalk.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DoWeTalk.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // --- TABLOLAR ---
        public DbSet<Friendship> Friendships { get; set; }
        public DbSet<ChatMessage> Messages { get; set; } 
        public DbSet<Server> Servers { get; set; }
        public DbSet<ServerMember> ServerMembers { get; set; }
        public DbSet<Channel> Channels { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<BlockedUser> BlockedUsers { get; set; }
        public DbSet<ServerRole> ServerRoles { get; set; }
        public DbSet<ServerMemberRole> ServerMemberRoles { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Indexes for scalability
            builder.Entity<ChatMessage>()
                .HasIndex(m => m.Timestamp)
                .IsDescending();

            builder.Entity<ServerMember>()
                .HasIndex(sm => new { sm.ServerId, sm.UserId })
                .IsUnique();

            builder.Entity<Friendship>()
                .HasIndex(f => new { f.User1Id, f.User2Id })
                .IsUnique();

            builder.Entity<BlockedUser>()
                .HasIndex(b => new { b.BlockerId, b.BlockedId })
                .IsUnique();

            builder.Entity<BlockedUser>()
                .HasOne(b => b.Blocker)
                .WithMany()
                .HasForeignKey(b => b.BlockerId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<BlockedUser>()
                .HasOne(b => b.Blocked)
                .WithMany()
                .HasForeignKey(b => b.BlockedId)
                .OnDelete(DeleteBehavior.Restrict);

            // Gönderen (Sender)
            builder.Entity<ChatMessage>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            // Alıcı Kullanıcı (Receiver - Özel Mesajlar için)
            builder.Entity<ChatMessage>()
                .HasOne(m => m.Receiver)
                .WithMany()
                .HasForeignKey(m => m.ReceiverId)
                .IsRequired(false) 
                .OnDelete(DeleteBehavior.Restrict);

            // Alıcı Kanal (Channel - Sunucu Mesajları için)
            builder.Entity<ChatMessage>()
                .HasOne(m => m.Channel)
                .WithMany()
                .HasForeignKey(m => m.ChannelId)
                .IsRequired(false) 
                .OnDelete(DeleteBehavior.Cascade); 

            // Sunucu Üyeleri (Çoka-Çok İlişki Köprüsü)
            builder.Entity<ServerMember>()
                .HasOne(sm => sm.Server)
                .WithMany(s => s.Members)
                .HasForeignKey(sm => sm.ServerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ServerMember>()
                .HasOne(sm => sm.User)
                .WithMany()
                .HasForeignKey(sm => sm.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Yeni roller ve yetkiler (Çoka-Çok Köprüsü)
            builder.Entity<ServerMemberRole>()
                .HasOne(smr => smr.ServerMember)
                .WithMany()
                .HasForeignKey(smr => smr.ServerMemberId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<ServerMemberRole>()
                .HasOne(smr => smr.ServerRole)
                .WithMany(sr => sr.MemberRoles)
                .HasForeignKey(smr => smr.ServerRoleId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<ServerRole>()
                .HasOne(sr => sr.Server)
                .WithMany()
                .HasForeignKey(sr => sr.ServerId)
                .OnDelete(DeleteBehavior.Cascade);

            // Channel -> Category
            builder.Entity<Channel>()
                .HasOne(c => c.Category)
                .WithMany(cat => cat.Channels)
                .HasForeignKey(c => c.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            // Category -> Server
            builder.Entity<Category>()
                .HasOne(cat => cat.Server)
                .WithMany()
                .HasForeignKey(cat => cat.ServerId)
                .OnDelete(DeleteBehavior.Cascade);

            // --- FRIENDSHIP YAPILANDIRMASI ---

            builder.Entity<Friendship>()
                .HasOne(f => f.User1)
                .WithMany()
                .HasForeignKey(f => f.User1Id)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Friendship>()
                .HasOne(f => f.User2)
                .WithMany()
                .HasForeignKey(f => f.User2Id)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}