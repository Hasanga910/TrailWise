using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddVehicleRegistrationNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RegistrationNumber",
                table: "Vehicles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            // Backfill existing rows with unique placeholder registration numbers so the UNIQUE index succeeds
            migrationBuilder.Sql("UPDATE \"Vehicles\" SET \"RegistrationNumber\" = 'WP-REG-' || RIGHT(\"Id\"::text, 8) WHERE \"RegistrationNumber\" = '' OR \"RegistrationNumber\" IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_RegistrationNumber",
                table: "Vehicles",
                column: "RegistrationNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Vehicles_RegistrationNumber",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "RegistrationNumber",
                table: "Vehicles");
        }
    }
}
