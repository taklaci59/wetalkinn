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
        
        // Voice Channel Occupancy Logic
        public Task UpdateVoiceChannelPresenceAsync(string userId, int channelId)
        {
            lock (_syncLock)
            {
                // Remove from any previous channel if exists
                RemoveVoiceChannelPresenceInternal(userId);
                
                // Add to new channel
                var occupants = _cache.GetOrCreate($"VoiceOccupants_{channelId}", entry =>
                {
                    entry.SetSlidingExpiration(TimeSpan.FromHours(6));
                    return new HashSet<string>();
                });
                
                if (occupants != null)
                {
                    occupants.Add(userId);
                }
                
                // Track user's current channel
                _cache.Set($"UserVoiceChannel_{userId}", channelId, TimeSpan.FromHours(6));
            }
            return Task.CompletedTask;
        }

        public Task RemoveVoiceChannelPresenceAsync(string userId)
        {
            lock (_syncLock)
            {
                RemoveVoiceChannelPresenceInternal(userId);
            }
            return Task.CompletedTask;
        }

        private void RemoveVoiceChannelPresenceInternal(string userId)
        {
            if (_cache.TryGetValue($"UserVoiceChannel_{userId}", out int oldChannelId))
            {
                var occupants = _cache.Get<HashSet<string>>($"VoiceOccupants_{oldChannelId}");
                if (occupants != null)
                {
                    occupants.Remove(userId);
                    if (occupants.Count == 0) _cache.Remove($"VoiceOccupants_{oldChannelId}");
                }
                _cache.Remove($"UserVoiceChannel_{userId}");
            }
        }

        public Task<List<string>> GetChannelOccupantsAsync(int channelId)
        {
            lock (_syncLock)
            {
                var occupants = _cache.Get<HashSet<string>>($"VoiceOccupants_{channelId}");
                return Task.FromResult(occupants != null ? occupants.ToList() : new List<string>());
            }
        }
    }
}
