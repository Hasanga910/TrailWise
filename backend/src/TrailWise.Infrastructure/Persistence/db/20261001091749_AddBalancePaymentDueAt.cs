using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddBalancePaymentDueAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "BalancePaymentDueAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_BalancePaymentDueAt",
                table: "Bookings",
                column: "BalancePaymentDueAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_BalancePaymentDueAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "BalancePaymentDueAt",
                table: "Bookings");
        }
    }
}
