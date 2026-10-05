using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrailWise.Infrastructure.Persistence.db
{
    /// <summary>
    /// Brings the Drivers table in line with the model. The model gained Driver.UserId, the
    /// Driver-User relation and a 200-character ContactInfo without a migration, and DbSeeder has
    /// been patching the column with raw SQL on every start. Databases are therefore in one of two
    /// states: created by migrations only (no UserId yet) or already patched by the seeder (UserId
    /// column, a partial unique index and an unnamed ON DELETE NO ACTION foreign key). Every
    /// statement below is idempotent so both end up identical, and nothing here discards data.
    /// DbSeeder's raw SQL (ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS with the
    /// same index name) becomes a no-op after this migration.
    /// </summary>
    public partial class AlignDriversWithModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Abort with a clear message instead of silently truncating existing values.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ""Drivers"" WHERE length(""ContactInfo"") > 200) THEN
        RAISE EXCEPTION 'Drivers.ContactInfo has values longer than 200 characters; shorten them before applying this migration.';
    END IF;
END $$;");

            migrationBuilder.Sql(@"ALTER TABLE ""Drivers"" ALTER COLUMN ""ContactInfo"" TYPE character varying(200);");

            migrationBuilder.Sql(@"ALTER TABLE ""Drivers"" ADD COLUMN IF NOT EXISTS ""UserId"" uuid;");

            // The seeder created this index as a partial one; the model wants a plain unique index.
            // They are equivalent (PostgreSQL unique indexes allow many NULLs), but keep the model exact.
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_Drivers_UserId"";");
            migrationBuilder.Sql(@"CREATE UNIQUE INDEX ""IX_Drivers_UserId"" ON ""Drivers"" (""UserId"");");

            // Replace the seeder's unnamed NO ACTION foreign key ("Drivers_UserId_fkey") with the
            // model's: deleting a user now unlinks the driver profile instead of failing.
            migrationBuilder.Sql(@"ALTER TABLE ""Drivers"" DROP CONSTRAINT IF EXISTS ""Drivers_UserId_fkey"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Drivers"" DROP CONSTRAINT IF EXISTS ""FK_Drivers_Users_UserId"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Drivers"" ADD CONSTRAINT ""FK_Drivers_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Only the lossless part is reverted. UserId, its index and its foreign key stay: on
            // existing databases the column predates this migration, and dropping it would destroy
            // the driver-to-user links.
            migrationBuilder.Sql(@"ALTER TABLE ""Drivers"" ALTER COLUMN ""ContactInfo"" TYPE text;");
        }
    }
}
