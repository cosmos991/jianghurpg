import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../../", import.meta.url));
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;grant usage on schema public to anon,authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
);
for (const file of readdirSync(root + "supabase/migrations").sort())
  await db.exec(readFileSync(root + "supabase/migrations/" + file, "utf8"));
await db.exec(readFileSync(root + "supabase/seed-era.sql", "utf8"));
const admin = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  unverified = "00000000-0000-4000-8000-000000000003";
await db.exec(
  `insert into auth.users values ('${admin}','owner@example.org',now()),('${user}','other@example.org',now()),('${unverified}','pending@example.org',null);insert into jianghu_private.era_admin_emails(email) values ('owner@example.org'),('pending@example.org');`,
);
const role = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
for (const id of [user, unverified]) {
  await role(id);
  assert.equal(
    (await db.query("select public.era_admin_access() as ok")).rows[0].ok,
    false,
  );
  assert.equal((await db.query("select * from era_templates")).rows.length, 0);
  await assert.rejects(
    db.query("select public.era_editor_catalog('demonic_rise_v1')"),
    /관리자/,
  );
  await assert.rejects(
    db.exec("insert into era_templates(id,name) values('unauthorized','bad')"),
    /row-level security/,
  );
}
await role(admin);
assert.equal(
  (await db.query("select public.era_admin_access() as ok")).rows[0].ok,
  true,
);
let doc = (
  await db.query("select public.era_editor_catalog('demonic_rise_v1') as doc")
).rows[0].doc;
assert.equal(doc.objectives.length, 10);
const initial = doc;
doc.era.description = "관리자 편집 테스트";
const save = async (doc, publish) =>
  (
    await db.query(
      "select public.save_era_editor_catalog($1,$2,$3::jsonb,$4) as doc",
      ["demonic_rise_v1", doc.era.updated_at, JSON.stringify(doc), publish],
    )
  ).rows[0].doc;
doc = await save(doc, false);
assert.equal(doc.era.description, "관리자 편집 테스트");
await assert.rejects(save(initial, false), /다른 곳에서 수정/);
const bad = structuredClone(doc);
bad.objectives[0].points = 6;
await assert.rejects(save(bad, true), /100/);
assert.equal(
  (await db.query("select points from era_objectives where id=$1", ["clue_01"]))
    .rows[0].points,
  5,
);
assert.equal(
  (await db.query("select status from era_templates")).rows[0].status,
  "draft",
);
doc = await save(doc, true);
assert.equal(doc.era.status, "published");
await role(user);
assert.equal((await db.query("select * from era_templates")).rows.length, 1);
assert.equal(
  (await db.query("update era_templates set name='hack' returning id")).rows
    .length,
  0,
);
await role(admin);
const prior = doc.era.updated_at;
await db.exec(
  "update era_objectives set description='외부 수정' where id='clue_01'",
);
assert.notEqual(
  (await db.query("select updated_at::text from era_templates")).rows[0]
    .updated_at,
  prior,
);
await assert.rejects(save(doc, false), /다른 곳에서 수정/);
console.log(
  "Admin schema verified: verified allowlist, draft access, atomic saves, publication checks, rollback, revision conflicts and non-admin denial.",
);
await db.close();
