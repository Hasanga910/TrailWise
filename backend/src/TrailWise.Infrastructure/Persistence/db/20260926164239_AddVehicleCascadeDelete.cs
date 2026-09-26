using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddVehicleCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VehicleAssignments_Vehicles_VehicleId",
                table: "VehicleAssignments");

            migrationBuilder.AddForeignKey(
                name: "FK_VehicleAssignments_Vehicles_VehicleId",
                table: "VehicleAssignments",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VehicleAssignments_Vehicles_VehicleId",
                table: "VehicleAssignments");

            migrationBuilder.AddForeignKey(
                name: "FK_VehicleAssignments_Vehicles_VehicleId",
                table: "VehicleAssignments",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
