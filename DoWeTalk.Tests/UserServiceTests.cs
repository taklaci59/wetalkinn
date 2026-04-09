using System.Threading.Tasks;
using DoWeTalk.Data;
using DoWeTalk.Data.Repositories;
using DoWeTalk.Models;
using DoWeTalk.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace DoWeTalk.Tests
{
    [TestClass]
    public class UserServiceTests
    {
        private ApplicationDbContext GetInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: System.Guid.NewGuid().ToString())
                .Options;
            return new ApplicationDbContext(options);
        }

        [TestMethod]
        public async Task RespondFriendRequestAsync_ShouldFail_WhenUserIdDoesNotMatchReceiver()
        {
            // Arrange
            var context = GetInMemoryDbContext();
            context.Friendships.Add(new Friendship 
            { 
                Id = 1, 
                User1Id = "senderId", 
                User2Id = "intendedReceiverId", 
                IsAccepted = false 
            });
            await context.SaveChangesAsync();

            var friendRepo = new Repository<Friendship>(context);
            var blockRepo = new Repository<BlockedUser>(context);
            
            // Note: We don't strictly need the full UserManager/PresenceService since they aren't hit for failure paths.
            // Using nulls for dependencies we don't hit in this specific branch.
            var userService = new UserService(friendRepo, blockRepo, null, null);

            // Act: Attacker tries to accept the request, using their own ID "attackerId"
            var result = await userService.RespondFriendRequestAsync(1, "attackerId", true);

            // Assert
            Assert.IsFalse(result);
            
            var friendship = await context.Friendships.FindAsync(1);
            Assert.IsFalse(friendship.IsAccepted);
        }
        
        [TestMethod]
        public async Task GetFriendIdsAsync_ShouldReturnDistinctIds()
        {
            // Arrange
            var context = GetInMemoryDbContext();
            context.Friendships.Add(new Friendship { Id = 1, User1Id = "myUser", User2Id = "friendA", IsAccepted = true });
            context.Friendships.Add(new Friendship { Id = 2, User1Id = "friendB", User2Id = "myUser", IsAccepted = true });
            context.Friendships.Add(new Friendship { Id = 3, User1Id = "myUser", User2Id = "friendC", IsAccepted = false });
            await context.SaveChangesAsync();

            var friendRepo = new Repository<Friendship>(context);
            var userService = new UserService(friendRepo, null, null, null);

            // Act
            var ids = await userService.GetFriendIdsAsync("myUser");

            // Assert
            Assert.AreEqual(2, ids.Count);
            Assert.IsTrue(ids.Contains("friendA"));
            Assert.IsTrue(ids.Contains("friendB"));
        }
    }
}
