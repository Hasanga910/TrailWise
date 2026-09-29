using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddBankTransferVerificationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankSlipUrl",
                table: "Payments",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Payments",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReviewedAt",
                table: "Payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedBy",
                table: "Payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SubmittedAt",
                table: "Payments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankSlipUrl",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                table: "Payments");
        }
    }
}
