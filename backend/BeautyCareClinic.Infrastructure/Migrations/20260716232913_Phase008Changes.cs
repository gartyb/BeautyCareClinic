using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase008Changes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DefaultDurationMinutes",
                table: "TreatmentTypes",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DefaultDurationMinutes",
                table: "TreatmentTypes");
        }
    }
}
