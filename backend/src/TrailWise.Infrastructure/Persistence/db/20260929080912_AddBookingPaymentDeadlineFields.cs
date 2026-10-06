using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddBookingPaymentDeadlineFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Bookings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PaymentDueAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PaymentExpiredAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PaymentDueAt",
                table: "Bookings",
                column: "PaymentDueAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_PaymentDueAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentDueAt",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "PaymentExpiredAt",
                table: "Bookings");
        }
    }
}
