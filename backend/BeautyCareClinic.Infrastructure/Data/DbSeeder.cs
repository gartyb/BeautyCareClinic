using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BeautyCareClinic.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(
        AppDbContext context,
        UserManager<AppUser> userManager,
        IConfiguration configuration,
        ILogger logger)
    {
        // Idempotent check — skip if any domain users already exist
        if (await context.Users.AnyAsync())
            return;

        // Read seed password from configuration; fall back to dev-only default with a warning
        var seedPassword = configuration["SeedData:DefaultPassword"];
        if (string.IsNullOrWhiteSpace(seedPassword))
        {
            seedPassword = "Clinic@123";
            logger.LogWarning(
                "SeedData:DefaultPassword is not configured. " +
                "Using built-in fallback password. " +
                "Set 'SeedData:DefaultPassword' in appsettings.Development.json.");
        }

        await using var transaction = await context.Database.BeginTransactionAsync();
        try
        {
            // Treatment types
            var treatmentTypes = new[]
            {
                new TreatmentType { Id = Guid.NewGuid(), Name = "פנים" },
                new TreatmentType { Id = Guid.NewGuid(), Name = "לייזר" },
                new TreatmentType { Id = Guid.NewGuid(), Name = "עיסוי" }
            };
            context.TreatmentTypes.AddRange(treatmentTypes);

            // Global settings
            var globalSettings = new[]
            {
                new GlobalSetting
                {
                    Id = Guid.NewGuid(),
                    Name = "default_max_payment_count",
                    Value = "12"
                }
            };
            context.GlobalSettings.AddRange(globalSettings);

            // Sample customers
            var customers = new[]
            {
                new Customer { Id = Guid.NewGuid(), FullName = "מיכל כהן",   Phone = "050-1234567", Email = "michal@example.com" },
                new Customer { Id = Guid.NewGuid(), FullName = "שירה לוי",   Phone = "052-2345678", Email = "shira@example.com"  },
                new Customer { Id = Guid.NewGuid(), FullName = "נועה ברק",   Phone = "054-3456789"                               },
                new Customer { Id = Guid.NewGuid(), FullName = "דנה אברהם",  Phone = "050-4567890", Email = "dana@example.com"   },
                new Customer { Id = Guid.NewGuid(), FullName = "רות פרידמן", Phone = "053-5678901"                               }
            };
            context.Customers.AddRange(customers);

            await context.SaveChangesAsync();

            // Users — Domain.User + AppUser share the same Guid Id
            var usersToSeed = new[]
            {
                (FullName: "ניהול אחראית",  Email: "manager@clinic.local",    Role: UserRole.Manager   ),
                (FullName: "טלי מטפלת",    Email: "therapist1@clinic.local",  Role: UserRole.Therapist ),
                (FullName: "שרה מטפלת",    Email: "therapist2@clinic.local",  Role: UserRole.Therapist ),
            };

            foreach (var u in usersToSeed)
            {
                var id = Guid.NewGuid();
                var normalizedEmail = u.Email.ToLowerInvariant();

                // Domain user (no framework references)
                var domainUser = new User
                {
                    Id    = id,
                    FullName = u.FullName,
                    Email = normalizedEmail,
                    Role  = u.Role
                };
                context.Users.Add(domainUser);

                // Identity user — same Id, provides password hashing / security stamp
                var appUser = new AppUser
                {
                    Id                  = id,
                    UserName            = normalizedEmail,
                    Email               = normalizedEmail,
                    NormalizedUserName  = normalizedEmail.ToUpperInvariant(),
                    NormalizedEmail     = normalizedEmail.ToUpperInvariant(),
                    EmailConfirmed      = true
                };

                var result = await userManager.CreateAsync(appUser, seedPassword);
                if (!result.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Failed to create user {u.Email}: " +
                        string.Join(", ", result.Errors.Select(e => e.Description)));
                }
            }

            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
