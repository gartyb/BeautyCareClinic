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

        // Read seed password from user-secrets or environment.
        // Never fall back to a hardcoded value — skip user seeding when absent.
        var seedPassword = configuration["SeedData:DefaultPassword"];
        var seedUsers    = !string.IsNullOrWhiteSpace(seedPassword);

        if (!seedUsers)
        {
            logger.LogWarning(
                "SeedData:DefaultPassword is not configured. " +
                "Skipping user seeding. " +
                "Set the password via: dotnet user-secrets set \"SeedData:DefaultPassword\" \"<password>\"");
        }

        await using var transaction = await context.Database.BeginTransactionAsync();
        try
        {
            // Treatment types
            var treatmentTypes = new[]
            {
                new TreatmentType { Id = Guid.NewGuid(), Name = "פנים",   DefaultDurationMinutes = 60 },
                new TreatmentType { Id = Guid.NewGuid(), Name = "לייזר",  DefaultDurationMinutes = 30 },
                new TreatmentType { Id = Guid.NewGuid(), Name = "עיסוי",  DefaultDurationMinutes = 60 }
            };
            context.TreatmentTypes.AddRange(treatmentTypes);

            // Global settings
            var globalSettings = new[]
            {
                new GlobalSetting { Id = Guid.NewGuid(), Name = "default_max_payment_count", Value = "12" },
                new GlobalSetting { Id = Guid.NewGuid(), Name = "calendar_start_hour",        Value = "8"  },
                new GlobalSetting { Id = Guid.NewGuid(), Name = "calendar_end_hour",           Value = "20" },
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

            if (seedUsers)
            {
                // Users — Domain.User + AppUser share the same Guid Id
                var usersToSeed = new[]
                {
                    (FullName: "ניהול אחראית",  Email: "manager@clinic.local",    Role: UserRole.Manager,   Phone: (string?)"050-0000000" ),
                    (FullName: "טלי מטפלת",    Email: "therapist1@clinic.local",  Role: UserRole.Therapist, Phone: (string?)"052-1111111" ),
                    (FullName: "שרה מטפלת",    Email: "therapist2@clinic.local",  Role: UserRole.Therapist, Phone: (string?)"054-2222222" ),
                };

                foreach (var u in usersToSeed)
                {
                    var id              = Guid.NewGuid();
                    var normalizedEmail = u.Email.ToLowerInvariant();

                    // Domain user (no framework references)
                    var domainUser = new User
                    {
                        Id       = id,
                        FullName = u.FullName,
                        Email    = normalizedEmail,
                        Role     = u.Role,
                        Phone    = u.Phone
                    };
                    context.Users.Add(domainUser);

                    // Identity user — same Id, provides password hashing / security stamp
                    var appUser = new AppUser
                    {
                        Id                 = id,
                        UserName           = normalizedEmail,
                        Email              = normalizedEmail,
                        NormalizedUserName = normalizedEmail.ToUpperInvariant(),
                        NormalizedEmail    = normalizedEmail.ToUpperInvariant(),
                        EmailConfirmed     = true
                    };

                    var result = await userManager.CreateAsync(appUser, seedPassword!);
                    if (!result.Succeeded)
                    {
                        throw new InvalidOperationException(
                            $"Failed to create user {u.Email}: " +
                            string.Join(", ", result.Errors.Select(e => e.Description)));
                    }
                }

                await context.SaveChangesAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
