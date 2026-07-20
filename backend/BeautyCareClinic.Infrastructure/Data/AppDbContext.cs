using BeautyCareClinic.Domain.Entities;
using BeautyCareClinic.Domain.Enums;
using BeautyCareClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BeautyCareClinic.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public new DbSet<User> Users { get; set; } = null!;
    public DbSet<Customer> Customers { get; set; } = null!;
    public DbSet<TreatmentType> TreatmentTypes { get; set; } = null!;
    public DbSet<PackageType> PackageTypes { get; set; } = null!;
    public DbSet<CustomerOrder> CustomerOrders { get; set; } = null!;
    public DbSet<OrderItem> OrderItems { get; set; } = null!;
    public DbSet<Payment> Payments { get; set; } = null!;
    public DbSet<TreatmentSeries> TreatmentSeries { get; set; } = null!;
    public DbSet<Treatment> Treatments { get; set; } = null!;
    public DbSet<TreatmentPhoto> TreatmentPhotos { get; set; } = null!;
    public DbSet<Appointment> Appointments { get; set; } = null!;
    public DbSet<TherapistWorkingHours> TherapistWorkingHours { get; set; } = null!;
    public DbSet<TherapistUnavailableDate> TherapistUnavailableDates { get; set; } = null!;
    public DbSet<TherapistCapability> TherapistCapabilities { get; set; } = null!;
    public DbSet<Note> Notes { get; set; } = null!;
    public DbSet<GlobalSetting> GlobalSettings { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Rename Identity tables to avoid confusion with domain tables
        modelBuilder.Entity<AppUser>().ToTable("AspNetUsers");

        // -----------------------------------------------------------------------
        // Domain.User — the Domain POCO (not the Identity user)
        // Domain.User.Id and AppUser.Id are the same Guid, linked at seeding time.
        // -----------------------------------------------------------------------
        modelBuilder.Entity<User>().ToTable("Users");

        // UserRole stored as string for readability in DB
        modelBuilder.Entity<User>()
            .Property(u => u.Role)
            .HasConversion<string>();

        // Email unique constraint on domain User table
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // User → Appointments (Restrict delete)
        modelBuilder.Entity<User>()
            .HasMany(u => u.Appointments)
            .WithOne(a => a.User)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // User → Treatments (Restrict delete)
        modelBuilder.Entity<User>()
            .HasMany(u => u.Treatments)
            .WithOne(t => t.User)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // User → Notes (Restrict delete)
        modelBuilder.Entity<User>()
            .HasMany(u => u.Notes)
            .WithOne(n => n.User)
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // -----------------------------------------------------------------------
        // AppointmentStatus stored as string
        // -----------------------------------------------------------------------
        modelBuilder.Entity<Appointment>()
            .Property(a => a.Status)
            .HasConversion<string>();

        // StartTime/EndTime are naive-local (no timezone) — see doc comments on
        // CreateAppointmentRequest/UpdateAppointmentRequest. Force "timestamp without time zone"
        // so Npgsql doesn't fall back to its default "timestamp with time zone" mapping and
        // misinterpret these as real UTC instants. CreatedAt stays timestamptz (genuinely UTC).
        modelBuilder.Entity<Appointment>()
            .Property(a => a.StartTime)
            .HasColumnType("timestamp without time zone");

        modelBuilder.Entity<Appointment>()
            .Property(a => a.EndTime)
            .HasColumnType("timestamp without time zone");

        // Composite indexes for calendar queries
        modelBuilder.Entity<Appointment>()
            .HasIndex(a => new { a.UserId, a.StartTime });

        modelBuilder.Entity<Appointment>()
            .HasIndex(a => new { a.CustomerId, a.StartTime });

        // Appointment → Customer (Restrict)
        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Customer)
            .WithMany(c => c.Appointments)
            .HasForeignKey(a => a.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // Appointment → TreatmentType (Restrict)
        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.TreatmentType)
            .WithMany(t => t.Appointments)
            .HasForeignKey(a => a.TreatmentTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Appointment>()
            .Property(a => a.UserFullName)
            .HasColumnName("user_full_name")
            .IsRequired()
            .HasDefaultValue(string.Empty);

        // -----------------------------------------------------------------------
        // TherapistWorkingHours — Weekday stored as string
        // -----------------------------------------------------------------------
        modelBuilder.Entity<TherapistWorkingHours>()
            .Property(t => t.Weekday)
            .HasConversion<string>();

        // -----------------------------------------------------------------------
        // PackageType
        // -----------------------------------------------------------------------
        modelBuilder.Entity<PackageType>()
            .Property(p => p.Price)
            .HasColumnType("decimal(10,2)");

        // -----------------------------------------------------------------------
        // TreatmentType
        // -----------------------------------------------------------------------
        modelBuilder.Entity<TreatmentType>()
            .HasIndex(t => t.Name)
            .IsUnique();

        modelBuilder.Entity<TreatmentType>()
            .HasMany(t => t.PackageTypes)
            .WithOne(p => p.TreatmentType)
            .HasForeignKey(p => p.TreatmentTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TreatmentType>()
            .HasMany(t => t.Treatments)
            .WithOne(t => t.TreatmentType)
            .HasForeignKey(t => t.TreatmentTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TreatmentType>()
            .HasMany(t => t.Notes)
            .WithOne(n => n.TreatmentType)
            .HasForeignKey(n => n.TreatmentTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        // -----------------------------------------------------------------------
        // Customer
        // -----------------------------------------------------------------------
        modelBuilder.Entity<Customer>()
            .HasIndex(c => c.FullName);

        modelBuilder.Entity<Customer>()
            .HasIndex(c => c.Phone);

        modelBuilder.Entity<Customer>()
            .HasMany(c => c.Orders)
            .WithOne(o => o.Customer)
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Customer>()
            .HasMany(c => c.Treatments)
            .WithOne(t => t.Customer)
            .HasForeignKey(t => t.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Customer>()
            .HasMany(c => c.Notes)
            .WithOne(n => n.Customer)
            .HasForeignKey(n => n.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // -----------------------------------------------------------------------
        // CustomerOrder
        // -----------------------------------------------------------------------
        modelBuilder.Entity<CustomerOrder>()
            .HasIndex(o => o.CustomerId);

        modelBuilder.Entity<CustomerOrder>()
            .Property(o => o.OriginalPrice)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<CustomerOrder>()
            .Property(o => o.DiscountedPrice)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<CustomerOrder>()
            .Property(o => o.DiscountPercentage)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<CustomerOrder>()
            .Property(o => o.AmountPaid)
            .HasColumnType("decimal(10,2)");

        // RemainingBalance is a PostgreSQL GENERATED ALWAYS AS (discounted_price - amount_paid) STORED column.
        // Never set this in C# — reload via Entry(order).ReloadAsync() after SaveChangesAsync.
        modelBuilder.Entity<CustomerOrder>()
            .Property(o => o.RemainingBalance)
            .HasColumnType("decimal(10,2)")
            .HasComputedColumnSql("\"DiscountedPrice\" - \"AmountPaid\"", stored: true)
            .ValueGeneratedOnAddOrUpdate();

        // CustomerOrder → Items (Cascade: items belong to the order)
        modelBuilder.Entity<CustomerOrder>()
            .HasMany(o => o.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // CustomerOrder → Payments (Cascade)
        modelBuilder.Entity<CustomerOrder>()
            .HasMany(o => o.Payments)
            .WithOne(p => p.Order)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // -----------------------------------------------------------------------
        // OrderItem
        // -----------------------------------------------------------------------
        modelBuilder.Entity<OrderItem>()
            .HasIndex(oi => oi.OrderId);

        modelBuilder.Entity<OrderItem>()
            .Property(oi => oi.UnitPrice)
            .HasColumnType("decimal(10,2)");

        // PackageNumber — stable per-customer package number (CR-031). No unique index: RC-1's
        // row-level lock on the Customer row during order creation makes numbering race-free
        // without needing a DB constraint (RC-2).
        modelBuilder.Entity<OrderItem>()
            .Property(oi => oi.PackageNumber)
            .IsRequired();

        // OrderItem → TreatmentSeries (1:1, Cascade: series belongs to item)
        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.TreatmentSeries)
            .WithOne(ts => ts.OrderItem)
            .HasForeignKey<TreatmentSeries>(ts => ts.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // TreatmentSeries.CustomerId — denormalized for fast active-series lookup
        modelBuilder.Entity<TreatmentSeries>()
            .HasIndex(ts => ts.CustomerId);

        modelBuilder.Entity<TreatmentSeries>()
            .HasOne(ts => ts.Customer)
            .WithMany()
            .HasForeignKey(ts => ts.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        // -----------------------------------------------------------------------
        // Payment
        // -----------------------------------------------------------------------
        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.OrderId);

        modelBuilder.Entity<Payment>()
            .Property(p => p.Amount)
            .HasColumnType("decimal(10,2)");

        // -----------------------------------------------------------------------
        // Treatment
        // -----------------------------------------------------------------------
        modelBuilder.Entity<Treatment>()
            .HasIndex(t => t.CustomerId);

        modelBuilder.Entity<Treatment>()
            .Property(t => t.Notes)
            .HasColumnName("notes")
            .HasColumnType("text");

        modelBuilder.Entity<Treatment>()
            .Property(t => t.PerformedByFullName)
            .HasColumnName("performed_by_full_name")
            .IsRequired()
            .HasDefaultValue(string.Empty);

        // Treatment → Photos (Cascade)
        modelBuilder.Entity<Treatment>()
            .HasMany(t => t.Photos)
            .WithOne(p => p.Treatment)
            .HasForeignKey(p => p.TreatmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // -----------------------------------------------------------------------
        // Note
        // -----------------------------------------------------------------------
        modelBuilder.Entity<Note>()
            .HasIndex(n => n.CustomerId);

        modelBuilder.Entity<Note>()
            .Property(n => n.WrittenByFullName)
            .HasColumnName("written_by_full_name")
            .IsRequired()
            .HasDefaultValue(string.Empty);

        modelBuilder.Entity<Note>()
            .Property(n => n.Content)
            .HasMaxLength(5000)
            .IsRequired();

        // -----------------------------------------------------------------------
        // GlobalSetting
        // -----------------------------------------------------------------------
        modelBuilder.Entity<GlobalSetting>()
            .HasIndex(g => g.Name)
            .IsUnique();
    }
}
