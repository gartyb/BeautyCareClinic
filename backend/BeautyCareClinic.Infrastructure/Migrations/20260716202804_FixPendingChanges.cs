using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixPendingChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Treatments_TreatmentSeries_TreatmentSeriesId",
                table: "Treatments");

            migrationBuilder.AddForeignKey(
                name: "FK_Treatments_TreatmentSeries_TreatmentSeriesId",
                table: "Treatments",
                column: "TreatmentSeriesId",
                principalTable: "TreatmentSeries",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Treatments_TreatmentSeries_TreatmentSeriesId",
                table: "Treatments");

            migrationBuilder.AddForeignKey(
                name: "FK_Treatments_TreatmentSeries_TreatmentSeriesId",
                table: "Treatments",
                column: "TreatmentSeriesId",
                principalTable: "TreatmentSeries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
