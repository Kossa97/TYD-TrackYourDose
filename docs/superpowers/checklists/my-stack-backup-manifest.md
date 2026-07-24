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
