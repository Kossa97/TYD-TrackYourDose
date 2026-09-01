# My Stack Backup Gate

- Code tag: `pre-my-stack-foundation-2026-07-21`
- Backup location: external, not committed
- Schema dump: restored successfully
- Data dump: restored successfully
- Storage `batch-files`: restored and listed
- Storage `progress-photos`: restored and listed
- Local color JSON: valid and hashed
- Vial visual baselines: desktop and mobile captured
- Restore check: passed before structural migration
- Sensitive files committed: no

## Compatible restore repair - 2026-07-24

- Backup location: external `pre-my-stack-foundation-2026-07-24-compatible-v2`
- Database schemas: `auth`, `public`, and `storage` in both schema and data dumps
- Schema SHA-256: `2E8F3B0BB12F7DA5B3FCBEDB55857BA915A39F80D0AC2C0211F7AE81E09E833E`
- Data SHA-256: `98167808B5CD236E94FC18D6C692BD4D6FAA1BA517D8E8C326CED86A80837C4C`
- SHA-256 manifest: `D8CBAE9217BA81011B986D25026C7B2B55FD5990EEEBC0156A094763B5950D2C`
- Source and restored Auth/Public/Storage row counts: matched
- Storage objects: 8 `batch-files`; `progress-photos` empty
- Native local restore: passed
- Local My Stack migration and verifier: passed before linked cutover
- Linked cutover: passed with explicit user approval
- Pre/post linked row counts: matched (`stack_items`: 14; `stack_item_ingredients`: 14)
- Linked foreign-key orphan check: zero across stack ingredients, vials, dose logs, cycles, effects, reviews, and injection logs
- Linked RLS/RPC verification: passed
- Existing Vial visual regression: passed on desktop and mobile
- Wizard smoke coverage: passed for catalog, custom, compound, edit, duplicate handling, and archive/restore; compound persistence and rendering are covered by automated tests without an additional linked QA write
- Local color migration: passed for the signed-in user's RLS-visible rows (7/7 deterministic colors persisted); the authorized Task 0 source export was `{}` with SHA-256 `CA3D163BAB055381827226140568F3BEF7EAAC187CEBD76878E0B63E9E442356`
- Linked QA records removed: yes (`qa_items`: 0; `qa_ingredients`: 0)

## Tracking-depth cutover checkpoint - 2026-08-17

No tracking-depth SQL has been executed against the linked database. The
repository has no local Supabase `config.toml` or migrations directory, so the
source-contract tests are the only completed pre-deployment database gate.

| Check | Pre-migration | Post-migration | Status |
| --- | --- | --- | --- |
| `stack_items` row count | Pending authorized linked query | Pending authorized linked query | Pending explicit user approval |
| `cycles` row count | Pending authorized linked query | Pending authorized linked query | Pending explicit user approval |
| `dose_logs` row count | Pending authorized linked query | Pending authorized linked query | Pending explicit user approval |
| `stack_item_inventory` row count | Table not yet deployed | Pending authorized linked query | Pending explicit user approval |
| `stack_item_inventory_movements` row count | Table not yet deployed | Pending authorized linked query | Pending explicit user approval |
| Orphaned foreign keys | Pending authorized linked verification | Expected: zero | Pending explicit user approval |
| Existing peptide and Vial rendering | Existing automated regression coverage retained | Authenticated desktop/mobile smoke pending | Partially verified locally |
| Nullable quantity semantics | N/A | Local automated tests require `null` dose/unit for intake-only and unknown taken amounts | Verified locally; linked smoke pending |
| Conservative rollback guard | Rollback SQL present | Runtime rollback drill not run | Pending explicit user approval |

Pre-deployment requirements:

- [x] Tracking-depth SQL contract tests cover Tasks 1, 5, 6, and 9.
- [x] Existing peptide/Vial automated rendering regressions remain in the local suite.
- [x] Nullable quantity and PK-interruption semantics are covered by local tests.
- [x] Capture the five exact pre-migration row counts above (see the 2026-08-28 section).
- [ ] Apply `supabase-my-stack-tracking-depth.sql` to the linked database only after explicit user approval.
- [ ] Run `supabase-my-stack-tracking-depth-verify.sql`; require every `tracking_depth_contract` boolean to be `true`.
- [ ] Capture matching post-migration row counts and verify zero orphaned foreign keys.
- [ ] Perform the seven authenticated browser smoke scenarios without reusing production records.
- [ ] Confirm existing peptide and Vial rendering on desktop and mobile after migration.
- [ ] Exercise the conservative rollback only in an approved drill or if verification fails.

Linked-production migration and all data-mutating authenticated smoke tests remain pending explicit user approval.

## Pre-migration backup — 2026-08-28

Taken before the tracking-depth migration, on the single linked project
`xcsk…qfbw` (Postgres 17.6.1). There is no second Supabase instance and no
local `config.toml`, so this migration has no rehearsal — the backup is the
only way back.

| Artifact | Size | Coverage |
| --- | --- | --- |
| `backup-2026-08-28-schema.sql` | 53 KB, 1074 lines | `public` only: 20 tables, 6 functions, 29 policies, 20 RLS enables, 33 foreign keys, 17 indexes |
| `backup-2026-08-28-data.sql` | 2.64 MB | 26 tables across `public`, `auth` and `storage` |

Both files are gitignored (`backup-*.sql`); no dump has ever been committed.

Schema coverage is deliberately narrower than the 2026-07-24 backup. That one
had to restore into a fresh project, so it needed `auth` and `storage` schemas
as well. This one covers a rollback *inside* the existing project: the
tracking-depth migration touches `public` only, while `auth` and `storage` are
platform-managed and stay in place. Their rows are still in the data dump.

Verified from the artifacts, without touching the database:

- `stack_item_inventory` and `stack_item_inventory_movements` are absent from
  the schema dump — independent confirmation that the migration has not run.
- The schema dump ends on complete `ALTER DEFAULT PRIVILEGES` statements, not
  mid-statement. (The Supabase CLI emits no `dump complete` marker.)

### Pre-migration row counts

Counted from `backup-2026-08-28-data.sql`, so no query was run against the
linked database.

| Table | Rows |
| --- | --- |
| `stack_items` | 15 |
| `stack_item_ingredients` | 15 |
| `cycles` | 148 |
| `dose_logs` | 9031 |
| `injection_logs` | 11 |
| `inventory_items` | 23 |
| `bloodwork` | 174 |
| `auth.users` | 13 |
| `stack_item_inventory` | table not yet deployed |
| `stack_item_inventory_movements` | table not yet deployed |

`stack_items` was 14 on 2026-07-24 and is 15 now — one item added since.

### Still open

The linked migration itself has not been run. The remaining unchecked boxes
above stay unchecked, and `supabase db query` is available as the execution
route if and when it is approved.
