using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BeautyCareClinic.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChangeAppointmentTimestampsToNaiveLocal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Do NOT use a plain AlterColumn here: EF's default-generated ALTER TABLE ... TYPE
            // timestamp without time zone has no USING clause, so Postgres falls back to
            // `col AT TIME ZONE current_setting('timezone')` — i.e. it depends on the session's
            // timezone GUC, which is non-deterministic across environments. StartTime/EndTime were
            // always naive-local clock digits mislabeled as UTC (see AppointmentsController), so
            // an explicit `AT TIME ZONE 'UTC'` reinterprets the existing digits as naive-local
            // without shifting them, regardless of session timezone config.
            migrationBuilder.Sql(
                "ALTER TABLE \"Appointments\" ALTER COLUMN \"StartTime\" TYPE timestamp without time zone USING \"StartTime\" AT TIME ZONE 'UTC';");
            migrationBuilder.Sql(
                "ALTER TABLE \"Appointments\" ALTER COLUMN \"EndTime\" TYPE timestamp without time zone USING \"EndTime\" AT TIME ZONE 'UTC';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Note: if any rows were inserted after Up() under the naive-local convention (correct
            // digits, Kind=Unspecified), rolling back here re-mislabels those already-correct
            // naive-local digits as a UTC instant — reintroducing the original bug for that data.
            // Inherent limitation of a schema-only rollback; not fixable here.
            migrationBuilder.Sql(
                "ALTER TABLE \"Appointments\" ALTER COLUMN \"StartTime\" TYPE timestamp with time zone USING \"StartTime\" AT TIME ZONE 'UTC';");
            migrationBuilder.Sql(
                "ALTER TABLE \"Appointments\" ALTER COLUMN \"EndTime\" TYPE timestamp with time zone USING \"EndTime\" AT TIME ZONE 'UTC';");
        }
    }
}
