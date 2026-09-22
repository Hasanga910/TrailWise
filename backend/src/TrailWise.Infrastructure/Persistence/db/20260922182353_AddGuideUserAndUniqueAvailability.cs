using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddGuideUserAndUniqueAvailability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GuideAvailabilities_GuideId_Date",
                table: "GuideAvailabilities");

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "Guides",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Guides_UserId",
                table: "Guides",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuideAvailabilities_GuideId_Date",
                table: "GuideAvailabilities",
                columns: new[] { "GuideId", "Date" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Guides_Users_UserId",
                table: "Guides",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Guides_Users_UserId",
                table: "Guides");

            migrationBuilder.DropIndex(
                name: "IX_Guides_UserId",
                table: "Guides");

            migrationBuilder.DropIndex(
                name: "IX_GuideAvailabilities_GuideId_Date",
                table: "GuideAvailabilities");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Guides");

            migrationBuilder.CreateIndex(
                name: "IX_GuideAvailabilities_GuideId_Date",
                table: "GuideAvailabilities",
                columns: new[] { "GuideId", "Date" });
        }
    }
}
