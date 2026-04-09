using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoWeTalk.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCustomUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomUrl",
                table: "Servers",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomUrl",
                table: "Servers");
        }
    }
}
