using System.Threading.Tasks;
using DoWeTalk.Data;
using DoWeTalk.Data.Repositories;
using DoWeTalk.Models;
using DoWeTalk.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace DoWeTalk.Tests
{
    [TestClass]
    public class AuthorizationTests
    {
        private ApplicationDbContext GetInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: System.Guid.NewGuid().ToString())
                .Options;
            return new ApplicationDbContext(options);
        }

        [TestMethod]
        public async Task CanSendMessageAsync_ShouldReturnFalse_WhenNotFriends()
        {
            // Arrange
            var context = GetInMemoryDbContext();
            var friendshipRepo = new Repository<Friendship>(context);
            var blockRepo = new Repository<BlockedUser>(context);
            var serverMemberRepo = new Repository<ServerMember>(context);

            var authService = new AuthorizationService(friendshipRepo, blockRepo, serverMemberRepo);

            // Act
            var result = await authService.CanSendMessageAsync("userA", "userB");

            // Assert
            Assert.IsFalse(result); // Because they are not friends
        }

        [TestMethod]
        public async Task CanSendMessageAsync_ShouldReturnFalse_WhenBlockedButFriends()
        {
            // Arrange
            var context = GetInMemoryDbContext();
            context.Friendships.Add(new Friendship { User1Id = "userA", User2Id = "userB", IsAccepted = true });
            context.BlockedUsers.Add(new BlockedUser { BlockerId = "userA", BlockedId = "userB" });
            await context.SaveChangesAsync();

            var friendshipRepo = new Repository<Friendship>(context);
            var blockRepo = new Repository<BlockedUser>(context);
            var serverMemberRepo = new Repository<ServerMember>(context);

            var authService = new AuthorizationService(friendshipRepo, blockRepo, serverMemberRepo);

            // Act
            var result = await authService.CanSendMessageAsync("userA", "userB");

            // Assert
            Assert.IsFalse(result);
        }

        [TestMethod]
        public async Task CanSendMessageAsync_ShouldReturnTrue_WhenFriendsAndNotBlocked()
        {
            // Arrange
            var context = GetInMemoryDbContext();
            context.Friendships.Add(new Friendship { User1Id = "userA", User2Id = "userB", IsAccepted = true });
            await context.SaveChangesAsync();

            var friendshipRepo = new Repository<Friendship>(context);
            var blockRepo = new Repository<BlockedUser>(context);
            var serverMemberRepo = new Repository<ServerMember>(context);

            var authService = new AuthorizationService(friendshipRepo, blockRepo, serverMemberRepo);

            // Act
            var result = await authService.CanSendMessageAsync("userA", "userB");

            // Assert
            Assert.IsTrue(result);
        }

        [TestMethod]
        public async Task FilterBlockedUsersAsync_ShouldRemoveBidirectionalBlocks()
        {
            // Arrange
            var context = GetInMemoryDbContext();
            // userA blocked userB
            context.BlockedUsers.Add(new BlockedUser { BlockerId = "userA", BlockedId = "userB" });
            // userC blocked userA
            context.BlockedUsers.Add(new BlockedUser { BlockerId = "userC", BlockedId = "userA" });
            await context.SaveChangesAsync();

            var friendshipRepo = new Repository<Friendship>(context);
            var blockRepo = new Repository<BlockedUser>(context);
            var serverMemberRepo = new Repository<ServerMember>(context);

            var authService = new AuthorizationService(friendshipRepo, blockRepo, serverMemberRepo);

            var candidates = new System.Collections.Generic.List<string> { "userB", "userC", "userD" };

            // Act
            var validUsers = await authService.FilterBlockedUsersAsync("userA", candidates);

            // Assert
            Assert.AreEqual(1, validUsers.Count);
            Assert.AreEqual("userD", validUsers[0]);
        }

        [TestMethod]
        public async Task PresenceService_MultiTab_ShouldTrackConnectionsCorrectly()
        {
            // Arrange
            var memoryCache = new MemoryCache(new MemoryCacheOptions());
            var presenceService = new PresenceService(memoryCache);

            // Act
            bool firstConn = await presenceService.UserConnectedAsync("testUser", "conn1");
            bool secondConn = await presenceService.UserConnectedAsync("testUser", "conn2");

            // Assert
            Assert.IsTrue(firstConn);
            Assert.IsFalse(secondConn);
            Assert.IsTrue(await presenceService.IsUserOnlineAsync("testUser"));

            // Act again
            bool disconnectedFirst = await presenceService.UserDisconnectedAsync("testUser", "conn1");
            
            // Assert
            Assert.IsFalse(disconnectedFirst);
            Assert.IsTrue(await presenceService.IsUserOnlineAsync("testUser"));

            // Act final disconnect
            bool disconnectedSecond = await presenceService.UserDisconnectedAsync("testUser", "conn2");

            // Assert
            Assert.IsTrue(disconnectedSecond);
            Assert.IsFalse(await presenceService.IsUserOnlineAsync("testUser"));
        }
    }
}
