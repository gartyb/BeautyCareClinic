using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPackageNumberToOrderItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: add the column as NULLABLE first — do NOT rely on a default value being
            // semantically correct for pre-existing rows (CR-031 / RC-4; this is the exact
            // sequencing mistake that caused the migration-drift bug fixed by
            // 20260719085129_AddTreatmentSeriesCustomerId / v0.10.2).
            migrationBuilder.AddColumn<int>(
                name: "PackageNumber",
                table: "OrderItems",
                type: "integer",
                nullable: true);

            // Step 2: deterministically backfill using a window function. OrderItem has no
            // creation-order column, and multiple items in one order share the same
            // CustomerOrder.OrderDate, so ordering must fall through OrderDate -> CustomerOrder.Id
            // -> OrderItem.Id to be fully deterministic (CR-031 / RC-3).
            migrationBuilder.Sql(
                """
                UPDATE "OrderItems" oi SET "PackageNumber" = t.rn
                FROM (
                  SELECT oi2."Id",
                         ROW_NUMBER() OVER (PARTITION BY co."CustomerId"
                                            ORDER BY co."OrderDate", co."Id", oi2."Id") AS rn
                  FROM "OrderItems" oi2
                  JOIN "CustomerOrders" co ON co."Id" = oi2."OrderId"
                ) t
                WHERE oi."Id" = t."Id";
                """);

            // Step 3: now that every row has a real value, tighten the column to NOT NULL.
            migrationBuilder.AlterColumn<int>(
                name: "PackageNumber",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PackageNumber",
                table: "OrderItems");
        }
    }
}
