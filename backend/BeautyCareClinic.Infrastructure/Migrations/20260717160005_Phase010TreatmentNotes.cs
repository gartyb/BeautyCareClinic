using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase010TreatmentNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "Treatments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "performed_by_full_name",
                table: "Treatments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "Notes",
                type: "character varying(5000)",
                maxLength: 5000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "written_by_full_name",
                table: "Notes",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "notes",
                table: "Treatments");

            migrationBuilder.DropColumn(
                name: "performed_by_full_name",
                table: "Treatments");

            migrationBuilder.DropColumn(
                name: "written_by_full_name",
                table: "Notes");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "Notes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(5000)",
                oldMaxLength: 5000);
        }
    }
}
