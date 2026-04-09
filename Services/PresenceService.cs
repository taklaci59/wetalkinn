using Microsoft.Extensions.Caching.Memory;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DoWeTalk.Services
{
    public class PresenceService : IPresenceService
    {
        private readonly IMemoryCache _cache;
        private static readonly object _syncLock = new object();

        public PresenceService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public Task<bool> UserConnectedAsync(string userId, string connectionId)
        {
            bool isFirstConnection = false;
            lock (_syncLock)
            {
                var connections = _cache.GetOrCreate($"UserConn_{userId}", entry =>
                {
                    entry.SetSlidingExpiration(TimeSpan.FromHours(24));
                    return new HashSet<string>();
                });

                if (connections != null)
                {
                    if (connections.Count == 0) isFirstConnection = true;
                    connections.Add(connectionId);
                }
            }
            return Task.FromResult(isFirstConnection);
        }

        public Task<bool> UserDisconnectedAsync(string userId, string connectionId)
        {
            bool isLastConnection = false;
            lock (_syncLock)
            {
                var connections = _cache.Get<HashSet<string>>($"UserConn_{userId}");
                if (connections != null)
                {
                    connections.Remove(connectionId);
                    if (connections.Count == 0)
                    {
                        isLastConnection = true;
                        _cache.Remove($"UserConn_{userId}");
                    }
                }
            }
            return Task.FromResult(isLastConnection);
        }

        public Task<string[]> GetOnlineUsersAsync()
        {
            return Task.FromResult(Array.Empty<string>());
        }

        public Task<bool> IsUserOnlineAsync(string userId)
        {
            var isOnline = false;
            lock (_syncLock)
            {
                var connections = _cache.Get<HashSet<string>>($"UserConn_{userId}");
                isOnline = connections != null && connections.Count > 0;
            }
            return Task.FromResult(isOnline);
        }

        public Task<IDictionary<string, bool>> GetPresenceAsync(IEnumerable<string> userIds)
        {
            var result = new Dictionary<string, bool>();
            lock (_syncLock)
            {
                foreach (var userId in userIds)
                {
                    var connections = _cache.Get<HashSet<string>>($"UserConn_{userId}");
                    result[userId] = connections != null && connections.Count > 0;
                }
            }
            return Task.FromResult<IDictionary<string, bool>>(result);
        }
    }
}
