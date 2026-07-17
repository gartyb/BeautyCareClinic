using System.Text;
using BeautyCareClinic.Application.Interfaces;
using BeautyCareClinic.Infrastructure.Data;
using BeautyCareClinic.Infrastructure.Identity;
using BeautyCareClinic.Infrastructure.Repositories;
using BeautyCareClinic.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using BeautyCareClinic.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Validate JWT secret is not the placeholder value
// ---------------------------------------------------------------------------
var jwtSecret = builder.Configuration["Jwt:Secret"];
const string JwtSecretPlaceholder = "REPLACE_WITH_USER_SECRETS_IN_DEV";

if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret == JwtSecretPlaceholder)
{
    throw new InvalidOperationException(
        "Jwt:Secret is not configured. " +
        "Set it via dotnet user-secrets: " +
        "dotnet user-secrets set \"Jwt:Secret\" \"<your-secret-here>\"");
}

// Fix 4 — Enforce JWT secret minimum length (≥ 32 bytes for HS256)
if (System.Text.Encoding.UTF8.GetBytes(jwtSecret).Length < 32)
    throw new InvalidOperationException(
        "Jwt:Secret must be at least 32 bytes (256 bits) for HS256. " +
        "Generate one with: openssl rand -base64 48");

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is not configured. " +
        "Set it via dotnet user-secrets or the ConnectionStrings__DefaultConnection environment variable.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// ---------------------------------------------------------------------------
// ASP.NET Core Identity
// ---------------------------------------------------------------------------
builder.Services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
{
    options.Password.RequireDigit           = true;
    options.Password.RequireLowercase       = true;
    options.Password.RequireUppercase       = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength         = 8;
    options.User.RequireUniqueEmail         = true;
    // Explicit lockout policy
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(15);
    options.Lockout.AllowedForNewUsers      = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ---------------------------------------------------------------------------
// JWT Authentication
// ---------------------------------------------------------------------------
var issuer   = builder.Configuration["Jwt:Issuer"]!;
var audience = builder.Configuration["Jwt:Audience"]!;
var keyBytes = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = issuer,
        ValidAudience            = audience,
        IssuerSigningKey         = new SymmetricSecurityKey(keyBytes),
        ClockSkew                = TimeSpan.Zero,
        // Pin to HS256 — reject tokens signed with a different algorithm (algorithm confusion attack)
        ValidAlgorithms          = new[] { SecurityAlgorithms.HmacSha256 }
    };
});

// ---------------------------------------------------------------------------
// Authorization Policies
// ---------------------------------------------------------------------------
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Manager",   policy => policy.RequireRole("Manager"));
    options.AddPolicy("Therapist", policy => policy.RequireRole("Therapist"));
});

// ---------------------------------------------------------------------------
// CORS — Development only: allow Vite dev server
// ---------------------------------------------------------------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy =>
    {
        policy.WithOrigins("http://localhost:5174")
              .AllowAnyHeader()
              .AllowAnyMethod();
        // Note: AllowCredentials() is NOT set — JWT is sent as Authorization header, not cookie
    });
});

// ---------------------------------------------------------------------------
// Swagger — Development only
// ---------------------------------------------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Beauty Care Clinic API",
        Version = "v1"
    });

    // JWT bearer input in Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header. Enter: Bearer {token}",
        Name        = "Authorization",
        In          = ParameterLocation.Header,
        Type        = SecuritySchemeType.ApiKey,
        Scheme      = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ---------------------------------------------------------------------------
// Application Services
// ---------------------------------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<ITreatmentTypeRepository, TreatmentTypeRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IGlobalSettingsRepository, GlobalSettingsRepository>();
builder.Services.AddScoped<IPackageTypeRepository, PackageTypeRepository>();
builder.Services.AddScoped<ICustomerOrderRepository, CustomerOrderRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<ITreatmentSeriesRepository, TreatmentSeriesRepository>();

builder.Services.AddControllers();

var app = builder.Build();

// ---------------------------------------------------------------------------
// Middleware Pipeline
// ---------------------------------------------------------------------------
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseCors("Development");
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ---------------------------------------------------------------------------
// Startup: run EF migrations + seed data (Development only)
// ---------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var context     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

    await context.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
    {
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var loggerFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
        var seederLogger  = loggerFactory.CreateLogger("DbSeeder");
        await DbSeeder.SeedAsync(context, userManager, configuration, seederLogger);
    }
}

app.Run();

// Make Program class accessible to integration tests
public partial class Program { }
