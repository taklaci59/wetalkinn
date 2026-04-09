using DoWeTalk.Models;
using DoWeTalk.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace DoWeTalk.Controllers
{
    public class AccountController : Controller
    {
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IUserService _userService;

        public AccountController(SignInManager<ApplicationUser> signInManager, UserManager<ApplicationUser> userManager, IUserService userService)
        {
            _signInManager = signInManager;
            _userManager = userManager;
            _userService = userService;
        }

        [HttpGet]
        public IActionResult Auth()
        {
            // Eğer kullanıcı zaten giriş yapmışsa direkt Chat'e gönder
            if (User.Identity.IsAuthenticated) return RedirectToAction("Dashboard", "Home");
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(RegisterViewModel model)
        {
            if (ModelState.IsValid)
            {
                var user = new ApplicationUser
                {
                    UserName = model.Username,
                    Email = model.Email,
                    Nickname = model.Username // Başlangıçta nickname kullanıcı adı olsun
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    await _signInManager.SignInAsync(user, isPersistent: false);
                    return RedirectToAction("Dashboard", "Home"); // Kayıt sonrası Chat'e git
                }

                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }
            }
            return View("Auth", model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(string EmailOrUsername, string Password)
        {
            // Basitlik için e-posta üzerinden giriş (Kullanıcı adı desteği eklenebilir)
            var result = await _signInManager.PasswordSignInAsync(EmailOrUsername, Password, false, lockoutOnFailure: true);

            if (result.Succeeded)
            {
                return RedirectToAction("Dashboard", "Home"); // Giriş başarılıysa Chat'e git
            }

            ModelState.AddModelError(string.Empty, "Geçersiz giriş denemesi.");
            return View("Auth");
        }

        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return RedirectToAction("Index", "Home");
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UpdateProfile(string username, string bio, string nickname)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            // JS only sends 'username' and 'bio', so we map 'username' to 'nickname' for safety,
            // or we just update what's sent.
            // Using nickname to avoid changing actual login identity.
            var success = await _userService.UpdateProfileAsync(user.Id, bio, null, username);
            
            return Json(new { success = success });
        }
    }
}
