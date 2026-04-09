using System.Linq;
using System.Threading.Tasks;
using DoWeTalk.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;

namespace DoWeTalk.Data
{
    public static class DbInitializer
    {
        public static async Task SeedRolesAsync(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var servers = await context.Servers.Include(s => s.Members).ToListAsync();

            foreach (var server in servers)
            {
                // Check if basic roles exist, if not create them
                var everyoneRole = await context.ServerRoles.FirstOrDefaultAsync(r => r.ServerId == server.Id && r.IsDefault);
                if (everyoneRole == null)
                {
                    everyoneRole = new ServerRole
                    {
                        ServerId = server.Id,
                        Name = "@everyone",
                        Position = 0,
                        IsDefault = true,
                        Permissions = ServerPermissions.SendMessages,
                        ColorHex = "#99aab5"
                    };
                    context.ServerRoles.Add(everyoneRole);
                    await context.SaveChangesAsync();
                }

                var adminRole = await context.ServerRoles.FirstOrDefaultAsync(r => r.ServerId == server.Id && r.Name == "Administrator");
                if (adminRole == null)
                {
                    adminRole = new ServerRole
                    {
                        ServerId = server.Id,
                        Name = "Administrator",
                        Position = 999, // Highest
                        ColorHex = "#ff0000",
                        Permissions = ServerPermissions.Administrator
                    };
                    context.ServerRoles.Add(adminRole);
                    await context.SaveChangesAsync();
                }

                // Migrate members
                foreach (var member in server.Members)
                {
                    var existingMappings = await context.ServerMemberRoles.Where(smr => smr.ServerMemberId == member.Id).ToListAsync();
                    
                    if (!existingMappings.Any(m => m.ServerRoleId == everyoneRole.Id))
                    {
                        context.ServerMemberRoles.Add(new ServerMemberRole { ServerMemberId = member.Id, ServerRoleId = everyoneRole.Id });
                    }

                    if (member.UserId == server.OwnerId)
                    {
                        if (!existingMappings.Any(m => m.ServerRoleId == adminRole.Id))
                        {
                            context.ServerMemberRoles.Add(new ServerMemberRole { ServerMemberId = member.Id, ServerRoleId = adminRole.Id });
                        }
                    }

                    // Reset string role to nothing or keep it for backward compat during migration.
                }
                
                // Ensure Server OwnerId is populated if null (legacy recovery)
                if (string.IsNullOrEmpty(server.OwnerId))
                {
                    // No more .Role, just check the first member if we are desperate, 
                    // but usually OwnerId should already be set.
                    var firstMember = server.Members.FirstOrDefault();
                    if (firstMember != null)
                    {
                        server.OwnerId = firstMember.UserId;
                        context.Servers.Update(server);
                    }
                }
            }

            await context.SaveChangesAsync();
        }
    }
}
