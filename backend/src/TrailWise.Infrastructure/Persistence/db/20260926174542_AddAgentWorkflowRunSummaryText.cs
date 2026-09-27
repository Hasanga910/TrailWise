using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <inheritdoc />
    public partial class AddAgentWorkflowRunSummaryText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SummaryText",
                table: "AgentWorkflowRuns",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SummaryText",
                table: "AgentWorkflowRuns");
        }
    }
}
