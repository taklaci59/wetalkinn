using System;

namespace DoWeTalk.Models
{
    [Flags]
    public enum ServerPermissions : long
    {
        None = 0,
        Administrator = 1 << 0,       // Full access
        ManageServer = 1 << 1,        // Can edit server profile (name, icon)
        ManageRoles = 1 << 2,         // Can create, delete, and edit roles lower than their highest role
        ManageChannels = 1 << 3,      // Can create, delete, and edit channels
        ManageCategories = 1 << 4,    // Can create, delete, and edit categories
        SendMessages = 1 << 5,        // Can send messages in text channels
        MentionEveryone = 1 << 6      // Can mention @everyone
    }
}
