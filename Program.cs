using DoWeTalk.Data;
using DoWeTalk.Models;
using DoWeTalk.Hubs; // ChatHub'ın bulunduğu klasörün doğruluğundan emin ol
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => 
    configuration.ReadFrom.Configuration(context.Configuration));

// 1. Veritabanı Bağlantısı
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Bağlantı cümlesi bulunamadı.");

builder.Services.AddDbContextPool<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// 2. Identity Yapılandırması
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options => {
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// Cookie: Giriş yapılmamış kullanıcıları doğru sayfaya yönlendir
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Auth";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/Auth";
});

// 3. Servisleri Kaydet
builder.Services.AddScoped(typeof(DoWeTalk.Data.Repositories.IRepository<>), typeof(DoWeTalk.Data.Repositories.Repository<>));
builder.Services.AddScoped<DoWeTalk.Services.IChatService, DoWeTalk.Services.ChatService>();
builder.Services.AddScoped<DoWeTalk.Services.IServerService, DoWeTalk.Services.ServerService>();
builder.Services.AddScoped<DoWeTalk.Services.IUserService, DoWeTalk.Services.UserService>();
builder.Services.AddSingleton<DoWeTalk.Services.IPresenceService, DoWeTalk.Services.PresenceService>();
builder.Services.AddScoped<DoWeTalk.Services.IAuthorizationService, DoWeTalk.Services.AuthorizationService>();
builder.Services.AddHttpClient<DoWeTalk.Services.IMetadataService, DoWeTalk.Services.MetadataService>();

builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();
builder.Services.AddMemoryCache();
builder.Services.AddSignalR();
builder.Services.AddRateLimiter(options => options.AddFixedWindowLimiter("GlobalPolicy", opt => { opt.Window = TimeSpan.FromSeconds(5); opt.PermitLimit = 100; }));

var app = builder.Build();

// Seeding roles on startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        await DoWeTalk.Data.DbInitializer.SeedRolesAsync(services);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the roles.");
    }
}

// 4. HTTP Pipeline (Ara Yazılımlar)
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseRateLimiter();

app.UseAuthentication(); // Kimlik doğrulama
app.UseAuthorization();  // Yetkilendirme

// 5. SignalR ve Route Haritalama
// JavaScript tarafındaki "/chatHub" isteğini burada karşılıyoruz
app.MapHub<ChatHub>("/chatHub").RequireAuthorization();

app.MapControllerRoute(
    name: "vanity",
    pattern: "{vanity}",
    defaults: new { controller = "Home", action = "JoinCustom" }
);

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapRazorPages();

app.Run();
