IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [AspNetRoles] (
    [Id] nvarchar(450) NOT NULL,
    [Name] nvarchar(256) NULL,
    [NormalizedName] nvarchar(256) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetUsers] (
    [Id] nvarchar(450) NOT NULL,
    [AvatarUrl] nvarchar(max) NULL,
    [BannerUrl] nvarchar(max) NULL,
    [Bio] nvarchar(max) NULL,
    [IsPlusMember] bit NOT NULL,
    [Nickname] nvarchar(max) NULL,
    [CreatedDate] datetime2 NOT NULL,
    [UserName] nvarchar(256) NULL,
    [NormalizedUserName] nvarchar(256) NULL,
    [Email] nvarchar(256) NULL,
    [NormalizedEmail] nvarchar(256) NULL,
    [EmailConfirmed] bit NOT NULL,
    [PasswordHash] nvarchar(max) NULL,
    [SecurityStamp] nvarchar(max) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    [PhoneNumber] nvarchar(max) NULL,
    [PhoneNumberConfirmed] bit NOT NULL,
    [TwoFactorEnabled] bit NOT NULL,
    [LockoutEnd] datetimeoffset NULL,
    [LockoutEnabled] bit NOT NULL,
    [AccessFailedCount] int NOT NULL,
    CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
);

CREATE TABLE [Servers] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [OwnerId] nvarchar(max) NOT NULL,
    [InviteCode] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Servers] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetRoleClaims] (
    [Id] int NOT NULL IDENTITY,
    [RoleId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserClaims] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserLogins] (
    [LoginProvider] nvarchar(450) NOT NULL,
    [ProviderKey] nvarchar(450) NOT NULL,
    [ProviderDisplayName] nvarchar(max) NULL,
    [UserId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
    CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserRoles] (
    [UserId] nvarchar(450) NOT NULL,
    [RoleId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
    CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserTokens] (
    [UserId] nvarchar(450) NOT NULL,
    [LoginProvider] nvarchar(450) NOT NULL,
    [Name] nvarchar(450) NOT NULL,
    [Value] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
    CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Friendships] (
    [Id] int NOT NULL IDENTITY,
    [User1Id] nvarchar(450) NOT NULL,
    [User2Id] nvarchar(450) NOT NULL,
    [IsAccepted] bit NOT NULL,
    CONSTRAINT [PK_Friendships] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Friendships_AspNetUsers_User1Id] FOREIGN KEY ([User1Id]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Friendships_AspNetUsers_User2Id] FOREIGN KEY ([User2Id]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [Channels] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [ServerId] int NOT NULL,
    [IsVoice] bit NOT NULL,
    CONSTRAINT [PK_Channels] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Channels_Servers_ServerId] FOREIGN KEY ([ServerId]) REFERENCES [Servers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [ServerMembers] (
    [Id] int NOT NULL IDENTITY,
    [ServerId] int NOT NULL,
    [UserId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_ServerMembers] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ServerMembers_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ServerMembers_Servers_ServerId] FOREIGN KEY ([ServerId]) REFERENCES [Servers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Messages] (
    [Id] int NOT NULL IDENTITY,
    [Content] nvarchar(max) NOT NULL,
    [Timestamp] datetime2 NOT NULL,
    [SenderId] nvarchar(450) NOT NULL,
    [ReceiverId] nvarchar(450) NULL,
    [ChannelId] int NULL,
    CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Messages_AspNetUsers_ReceiverId] FOREIGN KEY ([ReceiverId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Messages_AspNetUsers_SenderId] FOREIGN KEY ([SenderId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Messages_Channels_ChannelId] FOREIGN KEY ([ChannelId]) REFERENCES [Channels] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);

CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL;

CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);

CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);

CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);

CREATE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]);

CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;

CREATE INDEX [IX_Channels_ServerId] ON [Channels] ([ServerId]);

CREATE INDEX [IX_Friendships_User1Id] ON [Friendships] ([User1Id]);

CREATE INDEX [IX_Friendships_User2Id] ON [Friendships] ([User2Id]);

CREATE INDEX [IX_Messages_ChannelId] ON [Messages] ([ChannelId]);

CREATE INDEX [IX_Messages_ReceiverId] ON [Messages] ([ReceiverId]);

CREATE INDEX [IX_Messages_SenderId] ON [Messages] ([SenderId]);

CREATE INDEX [IX_ServerMembers_ServerId] ON [ServerMembers] ([ServerId]);

CREATE INDEX [IX_ServerMembers_UserId] ON [ServerMembers] ([UserId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260325113952_FixedInit', N'9.0.0');

DROP INDEX [IX_ServerMembers_ServerId] ON [ServerMembers];

DROP INDEX [IX_Friendships_User1Id] ON [Friendships];

CREATE TABLE [BlockedUsers] (
    [Id] int NOT NULL IDENTITY,
    [BlockerId] nvarchar(450) NOT NULL,
    [BlockedId] nvarchar(450) NOT NULL,
    [BlockedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_BlockedUsers] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_BlockedUsers_AspNetUsers_BlockedId] FOREIGN KEY ([BlockedId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_BlockedUsers_AspNetUsers_BlockerId] FOREIGN KEY ([BlockerId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
);

CREATE UNIQUE INDEX [IX_ServerMembers_ServerId_UserId] ON [ServerMembers] ([ServerId], [UserId]);

CREATE INDEX [IX_Messages_Timestamp] ON [Messages] ([Timestamp] DESC);

CREATE UNIQUE INDEX [IX_Friendships_User1Id_User2Id] ON [Friendships] ([User1Id], [User2Id]);

CREATE INDEX [IX_BlockedUsers_BlockedId] ON [BlockedUsers] ([BlockedId]);

CREATE UNIQUE INDEX [IX_BlockedUsers_BlockerId_BlockedId] ON [BlockedUsers] ([BlockerId], [BlockedId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260325130055_SystemUpgrade', N'9.0.0');

CREATE TABLE [AspNetRoles] (
    [Id] nvarchar(450) NOT NULL,
    [Name] nvarchar(256) NULL,
    [NormalizedName] nvarchar(256) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetUsers] (
    [Id] nvarchar(450) NOT NULL,
    [AvatarUrl] nvarchar(max) NULL,
    [BannerUrl] nvarchar(max) NULL,
    [Bio] nvarchar(500) NULL,
    [IsPlusMember] bit NOT NULL,
    [Nickname] nvarchar(30) NULL,
    [CreatedDate] datetime2 NOT NULL,
    [UserName] nvarchar(256) NULL,
    [NormalizedUserName] nvarchar(256) NULL,
    [Email] nvarchar(256) NULL,
    [NormalizedEmail] nvarchar(256) NULL,
    [EmailConfirmed] bit NOT NULL,
    [PasswordHash] nvarchar(max) NULL,
    [SecurityStamp] nvarchar(max) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    [PhoneNumber] nvarchar(max) NULL,
    [PhoneNumberConfirmed] bit NOT NULL,
    [TwoFactorEnabled] bit NOT NULL,
    [LockoutEnd] datetimeoffset NULL,
    [LockoutEnabled] bit NOT NULL,
    [AccessFailedCount] int NOT NULL,
    CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
);

CREATE TABLE [Servers] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [OwnerId] nvarchar(max) NOT NULL,
    [InviteCode] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_Servers] PRIMARY KEY ([Id])
);

CREATE TABLE [AspNetRoleClaims] (
    [Id] int NOT NULL IDENTITY,
    [RoleId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserClaims] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserLogins] (
    [LoginProvider] nvarchar(450) NOT NULL,
    [ProviderKey] nvarchar(450) NOT NULL,
    [ProviderDisplayName] nvarchar(max) NULL,
    [UserId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
    CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserRoles] (
    [UserId] nvarchar(450) NOT NULL,
    [RoleId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
    CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [AspNetUserTokens] (
    [UserId] nvarchar(450) NOT NULL,
    [LoginProvider] nvarchar(450) NOT NULL,
    [Name] nvarchar(450) NOT NULL,
    [Value] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
    CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [BlockedUsers] (
    [Id] int NOT NULL IDENTITY,
    [BlockerId] nvarchar(450) NOT NULL,
    [BlockedId] nvarchar(450) NOT NULL,
    [BlockedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_BlockedUsers] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_BlockedUsers_AspNetUsers_BlockedId] FOREIGN KEY ([BlockedId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_BlockedUsers_AspNetUsers_BlockerId] FOREIGN KEY ([BlockerId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [Friendships] (
    [Id] int NOT NULL IDENTITY,
    [User1Id] nvarchar(450) NOT NULL,
    [User2Id] nvarchar(450) NOT NULL,
    [IsAccepted] bit NOT NULL,
    CONSTRAINT [PK_Friendships] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Friendships_AspNetUsers_User1Id] FOREIGN KEY ([User1Id]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Friendships_AspNetUsers_User2Id] FOREIGN KEY ([User2Id]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
);

CREATE TABLE [Channels] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(max) NOT NULL,
    [ServerId] int NOT NULL,
    [IsVoice] bit NOT NULL,
    CONSTRAINT [PK_Channels] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Channels_Servers_ServerId] FOREIGN KEY ([ServerId]) REFERENCES [Servers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [ServerMembers] (
    [Id] int NOT NULL IDENTITY,
    [ServerId] int NOT NULL,
    [UserId] nvarchar(450) NOT NULL,
    [Role] nvarchar(max) NOT NULL DEFAULT N'Member',
    CONSTRAINT [PK_ServerMembers] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ServerMembers_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ServerMembers_Servers_ServerId] FOREIGN KEY ([ServerId]) REFERENCES [Servers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Messages] (
    [Id] int NOT NULL IDENTITY,
    [Content] nvarchar(max) NOT NULL,
    [Timestamp] datetime2 NOT NULL,
    [SenderId] nvarchar(450) NOT NULL,
    [ReceiverId] nvarchar(450) NULL,
    [ChannelId] int NULL,
    CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Messages_AspNetUsers_ReceiverId] FOREIGN KEY ([ReceiverId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Messages_AspNetUsers_SenderId] FOREIGN KEY ([SenderId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Messages_Channels_ChannelId] FOREIGN KEY ([ChannelId]) REFERENCES [Channels] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);

CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL;

CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);

CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);

CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);

CREATE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]);

CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;

CREATE INDEX [IX_BlockedUsers_BlockedId] ON [BlockedUsers] ([BlockedId]);

CREATE UNIQUE INDEX [IX_BlockedUsers_BlockerId_BlockedId] ON [BlockedUsers] ([BlockerId], [BlockedId]);

CREATE INDEX [IX_Channels_ServerId] ON [Channels] ([ServerId]);

CREATE UNIQUE INDEX [IX_Friendships_User1Id_User2Id] ON [Friendships] ([User1Id], [User2Id]);

CREATE INDEX [IX_Friendships_User2Id] ON [Friendships] ([User2Id]);

CREATE INDEX [IX_Messages_ChannelId] ON [Messages] ([ChannelId]);

CREATE INDEX [IX_Messages_ReceiverId] ON [Messages] ([ReceiverId]);

CREATE INDEX [IX_Messages_SenderId] ON [Messages] ([SenderId]);

CREATE INDEX [IX_Messages_Timestamp] ON [Messages] ([Timestamp] DESC);

CREATE UNIQUE INDEX [IX_ServerMembers_ServerId_UserId] ON [ServerMembers] ([ServerId], [UserId]);

CREATE INDEX [IX_ServerMembers_UserId] ON [ServerMembers] ([UserId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260327110008_TempCheck', N'9.0.0');

ALTER TABLE [Servers] ADD [CustomUrl] nvarchar(max) NULL;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260327124716_AddServerCustomUrl', N'9.0.0');

ALTER TABLE [Servers] ADD [BannerUrl] nvarchar(max) NULL;

ALTER TABLE [Servers] ADD [IconUrl] nvarchar(max) NULL;

ALTER TABLE [Channels] ADD [CategoryId] int NULL;

CREATE TABLE [Categories] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(32) NOT NULL,
    [ServerId] int NOT NULL,
    [Order] int NOT NULL,
    CONSTRAINT [PK_Categories] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Categories_Servers_ServerId] FOREIGN KEY ([ServerId]) REFERENCES [Servers] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_Channels_CategoryId] ON [Channels] ([CategoryId]);

CREATE INDEX [IX_Categories_ServerId] ON [Categories] ([ServerId]);

ALTER TABLE [Channels] ADD CONSTRAINT [FK_Channels_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260327164826_AddCategoriesAndServerProfiles', N'9.0.0');

ALTER TABLE [Channels] DROP CONSTRAINT [FK_Channels_Categories_CategoryId];

CREATE TABLE [ServerRoles] (
    [Id] int NOT NULL IDENTITY,
    [ServerId] int NOT NULL,
    [Name] nvarchar(64) NOT NULL,
    [ColorHex] nvarchar(7) NOT NULL,
    [Position] int NOT NULL,
    [Permissions] bigint NOT NULL,
    [IsDefault] bit NOT NULL,
    CONSTRAINT [PK_ServerRoles] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ServerRoles_Servers_ServerId] FOREIGN KEY ([ServerId]) REFERENCES [Servers] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [ServerMemberRoles] (
    [Id] int NOT NULL IDENTITY,
    [ServerMemberId] int NOT NULL,
    [ServerRoleId] int NOT NULL,
    CONSTRAINT [PK_ServerMemberRoles] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ServerMemberRoles_ServerMembers_ServerMemberId] FOREIGN KEY ([ServerMemberId]) REFERENCES [ServerMembers] ([Id]),
    CONSTRAINT [FK_ServerMemberRoles_ServerRoles_ServerRoleId] FOREIGN KEY ([ServerRoleId]) REFERENCES [ServerRoles] ([Id])
);

CREATE INDEX [IX_ServerMemberRoles_ServerMemberId] ON [ServerMemberRoles] ([ServerMemberId]);

CREATE INDEX [IX_ServerMemberRoles_ServerRoleId] ON [ServerMemberRoles] ([ServerRoleId]);

CREATE INDEX [IX_ServerRoles_ServerId] ON [ServerRoles] ([ServerId]);

ALTER TABLE [Channels] ADD CONSTRAINT [FK_Channels_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260329054217_AddServerRolesAndPermissions', N'9.0.0');

ALTER TABLE [AspNetUsers] ADD [AccentColor] nvarchar(20) NOT NULL DEFAULT N'';

ALTER TABLE [AspNetUsers] ADD [Theme] nvarchar(30) NOT NULL DEFAULT N'';

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260329072910_AddThemeAndAccent', N'9.0.0');

COMMIT;
GO

