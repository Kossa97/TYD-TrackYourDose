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
- Linked cutover: not executed; fresh user approval required
