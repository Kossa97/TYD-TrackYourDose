## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Sprachen beim Start

Die App wird zunächst **nur auf Deutsch und Englisch** veröffentlicht.

Das heißt für Textänderungen:
- `de` und `en` sind die einzigen Sprachen, deren Wortlaut zählt. Sie werden
  sorgfältig geschrieben und gegengelesen.
- Die zwölf übrigen Sprachdateien bleiben vollständig (der i18n-Vertrag in
  `src/features/my-stack/lib/i18n.test.ts` verlangt jeden Schlüssel in jeder
  Sprache), aber ihr Wortlaut ist nicht auslieferungsreif. Sinnvolle
  Übersetzungen eintragen, nicht daran feilen — und nicht so tun, als wären
  sie geprüft.
- Vor dem Start weiterer Sprachen muss jemand mit der Sprache drüberlesen.
