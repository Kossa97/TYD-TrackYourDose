# Coach ↔ Klient-Modell (v1)

Backend-Grundlage für den Coach-Zugang. SQL: `supabase-coach-clients.sql`
(im Supabase SQL Editor ausführen).

## Entscheidungen

- **Ein Account, zwei Rollen.** Ein Coach ist ein normaler Nutzer mit
  `profiles.is_coach = true`. Er kann selbst tracken **und** Klienten verwalten.
  Kein getrennter Account-Typ.
- **Freigabe pro Bereich.** Der Klient entscheidet einzeln, was ein Coach sehen
  darf: `stack`, `adherence`, `bloodwork`, `progress`, `diary`.
- **Mehrere Coaches je Klient** erlaubt (z. B. Trainer + Arzt gleichzeitig).
- **DSGVO:** Zugriff nur nach expliziter Zustimmung des Klienten (Einladung
  einlösen + Bereiche wählen), jederzeit widerrufbar.

## Tabellen

| Tabelle | Zweck |
|---|---|
| `profiles.is_coach` | Rolle-Flag |
| `coach_clients` | Verknüpfung Coach↔Klient + Status + Freigabe-Flags (`perm_*`) |
| `coach_invites` | Wiederverwendbarer Einladungscode/-link eines Coaches |

`coach_clients`-Status: `pending` · `active` · `revoked` · `declined`.
Freigabe-Flags: `perm_stack`, `perm_adherence`, `perm_bloodwork`,
`perm_progress`, `perm_diary` (alle default `false`).

## Bereich → Datentabellen

| Bereich | Tabellen |
|---|---|
| `stack` | `stack_items` |
| `adherence` | `dose_logs` |
| `bloodwork` | `bloodwork` |
| `progress` | `weight_logs`, `progress_photos` |
| `diary` | `effects`, `daily_logs` |

Der Coach-Lesezugriff wird per RLS erzwungen: jede dieser Tabellen bekommt eine
zusätzliche SELECT-Policy `coach_read_<tabelle>`, die
`public.coach_can_view(user_id, '<bereich>')` prüft. Die Policies werden
**schema-robust** nur auf existierende Tabellen mit `user_id`-Spalte angewendet
(siehe DO-Block im SQL) — bricht also nicht, falls der MyStack-Umbau eine
Tabelle noch umbenennt. Fehlt eine Tabelle, einfach das SQL erneut ausführen,
sobald sie existiert (idempotent).

## Flows (Front-end-Vertrag)

**Coach werden:** `update profiles set is_coach = true where id = auth.uid()`
(bzw. über ein Upgrade-/Onboarding-UI).

**Einladung erstellen (Coach):**
`insert into coach_invites (coach_id, label) values (auth.uid(), 'Instagram')`
→ `code` teilen als Link, z. B. `https://…/join/<code>`.

**Vorschau (Klient, vor Zustimmung):**
`supabase.rpc('coach_invite_info', { p_code })` → `{ coach_id, coach_name }`
für „Mit Coach X verbinden?".

**Einlösen + Freigaben wählen (Klient):**
```ts
await supabase.rpc('redeem_coach_invite', {
  p_code,
  p_perm_stack: true, p_perm_adherence: true,
  p_perm_bloodwork: false, p_perm_progress: true, p_perm_diary: false,
})
```
Legt/aktualisiert die aktive Verknüpfung mit den gewählten Freigaben.

**Freigaben ändern (Klient):**
`update coach_clients set perm_bloodwork = true where id = <link> and client_id = auth.uid()`.

**Widerrufen (Klient oder Coach):**
`update coach_clients set status='revoked', revoked_at=now() where id=<link>`.

**Coach-Dashboard:** Klientenliste über
`select * from coach_clients where coach_id = auth.uid() and status='active'`,
dann die freigegebenen Daten der Klienten normal per Supabase abfragen — RLS
liefert automatisch nur die erlaubten Zeilen/Bereiche.

## Bewusst später (v2)

- **`stack_item_ingredients`-Freigabe** (Zutaten) via Join auf `stack_items` —
  v1 zeigt dem Coach die Item-Kopfdaten (Name/Kategorie/Dosis), nicht die
  Einzel-Zutaten.
- **Spalten-genaue Update-Restriktion** auf `coach_clients` (v1: beide Seiten
  dürfen ihre Verknüpfungszeile ändern; App-Logik steuert die UI).
- **Öffentliches Coach-Profil** (Name, Bio, Avatar) + Coach-Verzeichnis.
- **Benachrichtigungen** (neue Verknüpfung, Widerruf).
- **Abrechnung** (Coach zahlt pro Klient) — separate Schicht.
