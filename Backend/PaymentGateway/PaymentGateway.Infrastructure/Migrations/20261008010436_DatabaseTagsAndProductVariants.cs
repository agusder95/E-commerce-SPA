using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DatabaseTagsAndProductVariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                table: "TAGS",
                type: "text",
                nullable: false,
                computedColumnSql: "upper(regexp_replace(normalize(regexp_replace(btrim(\"Name\"), '\\s+', ' ', 'g'), NFD), '[\\u0300-\\u036f]', '', 'g'))",
                stored: true);

            // Products store tag names as a JSON array, not foreign keys. Preserve their
            // associations while consolidating case/accent-equivalent dictionary entries.
            migrationBuilder.Sql("""
                CREATE FUNCTION pg_temp.tag_key(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
                    SELECT upper(regexp_replace(normalize(regexp_replace(btrim(value), '\s+', ' ', 'g'), NFD), '[\u0300-\u036f]', '', 'g'));
                $$;
                CREATE FUNCTION pg_temp.tag_array(value text) RETURNS jsonb LANGUAGE plpgsql AS $$
                BEGIN
                    IF jsonb_typeof(value::jsonb) = 'array' THEN RETURN value::jsonb; END IF;
                    RETURN '[]'::jsonb;
                EXCEPTION WHEN OTHERS THEN RETURN '[]'::jsonb;
                END;
                $$;
                DELETE FROM "TAGS" a USING "TAGS" b
                    WHERE a."NormalizedName" = b."NormalizedName" AND a."Id_Tag" > b."Id_Tag";
                UPDATE "TAGS" SET "Name" = CASE "NormalizedName"
                    WHEN 'FISICO' THEN 'Físico' WHEN 'DIGITAL' THEN 'Digital'
                    ELSE upper(left(normalize(regexp_replace(btrim("Name"), '\s+', ' ', 'g'), NFC), 1)) ||
                         lower(substr(normalize(regexp_replace(btrim("Name"), '\s+', ' ', 'g'), NFC), 2)) END;
                INSERT INTO "TAGS" ("Name")
                    SELECT name FROM (VALUES ('Físico'), ('Digital')) v(name)
                    WHERE NOT EXISTS (SELECT 1 FROM "TAGS" t WHERE t."NormalizedName" = pg_temp.tag_key(v.name));
                INSERT INTO "TAGS" ("Name")
                    SELECT DISTINCT ON (pg_temp.tag_key(value))
                        upper(left(normalize(regexp_replace(btrim(value), '\s+', ' ', 'g'), NFC), 1)) ||
                        lower(substr(normalize(regexp_replace(btrim(value), '\s+', ' ', 'g'), NFC), 2))
                    FROM "PRODUCTS" p, jsonb_array_elements_text(pg_temp.tag_array(p."Tags")) v(value)
                    WHERE char_length(regexp_replace(btrim(value), '\s+', ' ', 'g')) BETWEEN 1 AND 50
                        AND NOT EXISTS (SELECT 1 FROM "TAGS" t WHERE t."NormalizedName" = pg_temp.tag_key(value))
                    ORDER BY pg_temp.tag_key(value), value;
                UPDATE "PRODUCTS" p SET "Tags" = (
                    SELECT jsonb_agg(name ORDER BY name)::text FROM (
                        SELECT DISTINCT t."Name" AS name FROM jsonb_array_elements_text(pg_temp.tag_array(p."Tags")) v(value)
                            JOIN "TAGS" t ON t."NormalizedName" = pg_temp.tag_key(value)
                            WHERE t."NormalizedName" NOT IN ('FISICO', 'DIGITAL')
                        UNION SELECT "Name" FROM "TAGS"
                            WHERE "NormalizedName" = CASE WHEN p."Type" = 'PHYSICAL' THEN 'FISICO' ELSE 'DIGITAL' END
                    ) names
                );
                DROP FUNCTION pg_temp.tag_array(text);
                DROP FUNCTION pg_temp.tag_key(text);
                """);

            migrationBuilder.CreateIndex(
                name: "UQ_TAGS_NormalizedName",
                table: "TAGS",
                column: "NormalizedName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UQ_TAGS_NormalizedName",
                table: "TAGS");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                table: "TAGS");
        }
    }
}
