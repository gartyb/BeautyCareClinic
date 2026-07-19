using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatmentSeriesCustomerId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CustomerId",
                table: "TreatmentSeries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Backfill CustomerId for any pre-existing TreatmentSeries rows (the column above
            // has no meaningful default) by walking OrderItem -> CustomerOrder -> CustomerId.
            // On an empty TreatmentSeries table this UPDATE affects 0 rows and is a no-op.
            migrationBuilder.Sql(
                """
                UPDATE "TreatmentSeries" ts
                SET "CustomerId" = co."CustomerId"
                FROM "OrderItems" oi
                JOIN "CustomerOrders" co ON co."Id" = oi."OrderId"
                WHERE ts."OrderItemId" = oi."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_TreatmentSeries_CustomerId",
                table: "TreatmentSeries",
                column: "CustomerId");

            migrationBuilder.AddForeignKey(
                name: "FK_TreatmentSeries_Customers_CustomerId",
                table: "TreatmentSeries",
                column: "CustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TreatmentSeries_Customers_CustomerId",
                table: "TreatmentSeries");

            migrationBuilder.DropIndex(
                name: "IX_TreatmentSeries_CustomerId",
                table: "TreatmentSeries");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "TreatmentSeries");
        }
    }
}
