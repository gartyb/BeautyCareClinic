using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase009OrdersPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecordedByFullName",
                table: "Payments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "RecordedByUserId",
                table: "Payments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "PackageTypes",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitPrice",
                table: "OrderItems",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "RemainingBalance",
                table: "CustomerOrders",
                type: "numeric(10,2)",
                nullable: false,
                computedColumnSql: "\"DiscountedPrice\" - \"AmountPaid\"",
                stored: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(10,2)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecordedByFullName",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "RecordedByUserId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Price",
                table: "PackageTypes");

            migrationBuilder.DropColumn(
                name: "UnitPrice",
                table: "OrderItems");

            migrationBuilder.AlterColumn<decimal>(
                name: "RemainingBalance",
                table: "CustomerOrders",
                type: "numeric(10,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(10,2)",
                oldComputedColumnSql: "\"DiscountedPrice\" - \"AmountPaid\"");
        }
    }
}
