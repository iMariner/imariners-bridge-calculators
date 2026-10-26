# Ship reporting system record (one JSON file per system or per zone, UTF-8)

File name: `data/reporting/<id>.json`. One record per area that has its own boundary, address or rules
(e.g. SURNAV has one record per French zone: Channel/Atlantic, Mediterranean, Antilles, Guiana, La Réunion/Mayotte, ...).

```jsonc
{
  "id": "surnav-antilles",                 // kebab-case, unique
  "system": "SURNAV",                      // family / short name used on board
  "title": "SURNAV French Antilles",
  "country": "France",                     // authority's country (or "IMO" region text for multi-state systems)
  "authority": "CROSS Antilles-Guyane (MRCC Fort-de-France)",
  "kind": "mandatory-imo" | "mandatory-national" | "voluntary",
  "resolution": "MSC.190(79)" | null,      // IMO adopting resolution (and amendments) if IMO-adopted
  "status": "in effect" | "adopted, not yet in effect" | "withdrawn",
  "effective": "2005-07-01" | null,
  "applies_to": "who must report, as the source words it (ship types, size, cargo)",
  "applies_quote": "exact wording from the source",

  "when": [                                // every report the system asks for
    { "event": "before_entry" | "entry" | "exit" | "departure" | "before_arrival" | "arrival" | "position" | "deviation" | "final" | "other",
      "hours_before": 6 | null,           // for before_entry / before_arrival: hours ahead
      "interval_h": 24 | null,            // for periodic position reports
      "report": "SP" | "PR" | "DR" | "FR" | "SR" | null,   // name of the report type if the system uses one
      "text": "exact rule wording from the source" }
  ],

  "how": [                                 // every channel, in the order the source prefers
    { "type": "email" | "vhf" | "mf" | "inmarsat-c" | "phone" | "fax" | "telex" | "web" | "other",
      "value": "antilles@mrccfr.eu" | "CH 16" | "+33 ...",
      "to": "CROSS Antilles-Guyane",
      "note": "e.g. 'when within VHF range', 'primary'" }
  ],
  "addressee": "text of the address line the message must carry, exactly, or null",
  "heading": "exact subject / heading line the message must carry, or null",

  "lines": [                               // the report content, in the IMO A.851(20) letters when the system uses them
    { "l": "A", "req": "required" | "optional" | "if-applicable",
      "text": "what the system asks for on this line, as worded by the source" }
  ],
  "format_note": "anything special about the format (own letters, language, report names), or null",

  "area": {
    "shape": "polygon" | "lines" | "circle" | "territorial-sea" | "eez" | "port" | "lat_limit" | "global",
      // polygon: points form a closed ring
      // lines: area closed partly by the coast; give "lines": [["1","2"],["3","4"]] = point sequences that are the official boundary
      // circle: "center" point + "radius_nm"
      // territorial-sea / eez: boundary is the state's 12 NM / 200 NM limit (give "state" and "zone" text), no points needed
      // port: report is tied to arrival at named ports, give "ports": [...]
      // global: no area (e.g. AMVER)
    "points": [ { "n": "1", "name": "optional", "lat": "49 54.00N", "lon": "002 54.00W", "inferred": false } ],
      // lat/lon EXACTLY as printed, normalised to space-separated "DD MM.mm[N/S]" / "DDD MM.mm[E/W]" (or "DD MM SS[N/S]").
      // inferred: true for anything not printed in the source (closing a polygon over land, computed coast points)
    "lines": [],
    "center": null, "radius_nm": null,
    "state": null, "zone": null, "ports": [],
    "inside_hint": { "lat": 15.0, "lon": -61.0 },   // a position clearly INSIDE at sea
    "bbox": [ -64, 13, -58, 19 ]                    // [lon_min, lat_min, lon_max, lat_max] for the map view
  },
  "area_quote": "exact definition text of the area as printed (may shorten long point lists with ...)",

  "sources": [ { "title": "IMO MSC.190(79) WETREP", "ref": "Annex, para 2", "date": "2004-12-06",
                 "url": "https://...", "primary": true } ],
  "checked": "2026-10-26",                 // date you checked the sources
  "verification": "how you got each part (PDF page, web page, cross-checked with ...)",
  "confidence": "high" | "medium" | "low",
  "notes": "anything the officer must know; gaps; things NOT confirmed"
}
```

Rules
- Official sources only: IMO resolutions and SN circulars, the national authority's own notices, laws, port
  regulations, MSA / Prémar / Harbour Master orders, national Notices to Mariners. Name each source with URL and date.
- Do NOT copy text from the Admiralty List of Radio Signals (UKHO copyright; this repository is public). Secondary
  sources (P&I circulars, agents, forums) may help you find the official text, but never replace it; if only a
  secondary source exists, say so in `notes` and set confidence "low".
- Never invent or "tidy" a coordinate, an email address or a VHF channel. Copy exactly. Anything computed or assumed
  is `inferred: true` and explained in `notes`.
- If the rules changed over time, give the current ones and mention the change in `notes`.
