import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const db = new PGlite();
const root = fileURLToPath(new URL("../../", import.meta.url));
await db.exec(
  "create role anon; create role authenticated; grant usage on schema public to anon, authenticated;",
);
const migration = readdirSync(root + "supabase/migrations").find((f) =>
  f.endsWith("_era_catalog.sql"),
);
await db.exec(readFileSync(root + "supabase/migrations/" + migration, "utf8"));
await db.exec(readFileSync(root + "supabase/seed-era.sql", "utf8"));
await db.exec(readFileSync(root + "supabase/seed-era.sql", "utf8"));
assert.equal(
  (await db.query("select sum(points)::int as total from era_objectives"))
    .rows[0].total,
  100,
);
await db.exec("set role anon");
assert.equal((await db.query("select * from era_templates")).rows.length, 0);
assert.equal((await db.query("select * from era_objectives")).rows.length, 0);
await assert.rejects(
  db.exec("update era_templates set name='bad'"),
  /permission denied/,
);
await db.exec("reset role");
await db.exec(
  "update era_templates set status='published' where id='demonic_rise_v1'",
);
for (const role of ["anon", "authenticated"]) {
  await db.exec("set role " + role);
  assert.equal((await db.query("select * from era_templates")).rows.length, 1);
  assert.equal(
    (await db.query("select * from era_objectives")).rows.length,
    10,
  );
  assert.equal((await db.query("select * from era_outcomes")).rows.length, 5);
  await assert.rejects(
    db.exec("delete from era_objectives"),
    /permission denied/,
  );
  await db.exec("reset role");
}
await assert.rejects(
  db.exec("update era_objectives set points=6 where id='clue_01'"),
  /100/,
);
await assert.rejects(
  db.exec("update era_outcomes set min_score=26 where id='defense'"),
  /빈틈/,
);
await assert.rejects(
  db.exec(
    "update era_outcomes set required_objective_ids='{missing}' where id='decisive'",
  ),
  /존재하지/,
);
await db.exec("update era_templates set status='draft'");
await db.exec("update era_objectives set points=6 where id='clue_01'");
await assert.rejects(
  db.exec("update era_templates set status='published'"),
  /100/,
);
console.log(
  "SQL verified: schema, seed re-run, 100 points, draft privacy, published reads, denied client writes, invalid publication and outcome validation.",
);
await db.close();
