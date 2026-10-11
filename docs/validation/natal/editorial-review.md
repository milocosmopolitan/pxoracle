# Representative natal report review

Date: 2026-10-11. Reviewer: implementation agent, not an independent human editor.
All inputs are synthetic. Native fixtures are in `tests/fixtures/natal.json`; the
browser-produced [complete HTML report](evidence/completed-report.html) uses the
synthetic Seoul input shown in its header. Coverage tests prove reference availability,
not the truth of astrology or human approval of the prose.

## Exact chart and competing needs

The 2000-01-01 12:00 UTC fixture has Sun/Ascendant in Capricorn, Moon in Scorpio,
Sun–Saturn trine, Moon–Saturn opposition and Moon–Uranus square. The report preserves
the distinction between a dependable direction and emotional strain instead of
averaging the passages into an unqualified “disciplined person” description.

Selected Sun–Saturn text:

> The Sun-Saturn relationship connects identity with responsibility, standards and
> the effort to make a contribution durable. A chosen structure can support purpose
> over time. It matters whether the standard serves that purpose or becomes a
> condition under which you are allowed to feel legitimate, capable or deserving of
> rest. Patience can give purpose a dependable form; allowing revision keeps
> competence from hardening into a role you can never set down.

Its tension, “Reliability can attract more responsibility than is sustainable,”
qualifies the ease of the trine rather than declaring a guaranteed benefit. The
Moon–Saturn text allows both responsibility and vulnerability. These passages can
coexist: public reliability does not establish that emotional support is effortless.

The care/structure theme uses Venus in house 12 and Capricorn Ascendant:

> One part of the evidence emphasizes responsiveness while another emphasizes
> limits or continuity. Together they suggest that care may be easier to offer and
> receive when its practical terms are clear. A routine or agreement should serve
> a real need, with enough flexibility to change when that need changes.

Practice: “Build one realistic form of support into a recurring arrangement.”
Question: “What structure would make care more available without making it compulsory?”
Both follow the paragraph's condition: structure supports care and remains revisable.
The evidence buttons expose the actual placements; the prose does not claim a
relationship outcome or knowledge of a personal history.

## Different chart, personal versus generational emphasis

The 1966-06-01 fixture changes the core to Gemini Sun, Scorpio Moon and Cancer
Ascendant. Its leading theme is care, supported by Cancer Ascendant and Moon in
house 5. “Choose one reciprocal form of care with a clear limit” addresses that
theme without assuming the person is a parent. The Sun–Mercury conjunction ranks
above the slow outer-planet background. It explicitly allows changing one's mind
without losing a recognizable point of view; its tension identifies the risk of
hearing criticism of an idea as criticism of the whole person.

Uranus/Neptune/Pluto sign and mutual-pair passages are labeled shared generational
background. Personal contacts and calculated houses provide more individual context.
The report does not interpret a cohort placement as an exclusive personality trait.

## Capability and boundary cases

- **Approximate ±90 minutes and unknown time:** all sign passages carry the
  conditional-sample label, even when only one sign was observed. ASC, houses,
  aspects and definitive repeated themes are absent. Sampling language appears
  before the core map and beside distributions, not only in the footer.
- **Moon boundary, 2000-01-02 unknown time:** both Scorpio and Sagittarius Moon
  passages are offered conditionally. Moon is excluded from the fixed sampled-sign
  counts; there is no averaged Moon personality or definitive element total.
- **Polar, latitude 70°:** supported planetary sign/aspect text remains; neither
  an ASC nor a house is invented. The structure theme instead uses Mercury and Sun
  in Capricorn. Its action reviews an obligation's purpose, consistent with its
  warning that more discipline is not automatically useful.
- **No major aspects, all configured orbs zero:** placements/themes remain usable.
  The explicit absence passage says the configured list is empty, not that the
  person lacks relationships or capacities.
- **Wide orbs, all 15°:** the top relationship changes to Sun–Moon sextile. Its
  practical treatment coordinates direction and care through modest adjustments;
  it does not exaggerate wider aspects into stronger objective effects. Full orb
  values and settings remain auditable. Exact inclusion and just-outside limits
  are tested separately in Rust.
- **Historical Seoul, 1955-01-01:** the engine resolves UTC+08:30. The theme links
  Moon in house 1 with Sun in house 10; it does not use today's UTC+09:00 or claim
  historical geographic certainty from a modern city point.
- **Degree boundaries:** formatting floors sign-local arcminutes, preserving
  29°59′ rather than displaying 0° in the wrong sign. The 0/360 marker stress story
  shifts display markers while leader lines preserve original longitudes.

## Fallback review and remaining editorial limits

The conservative Mercury–Venus square and Neptune–Pluto opposition keys have no
daily-grid witness in the supported date range. Their displayed fallback label and
pair-level text make no aspect-specific personal claim. A finite daily scan does
not prove an event impossible between samples. Nine other inner-planet combinations
are excluded by the elongation/orb limits documented in the content README.

All 493 article bodies are distinct; all supported placements and 214 witnessed
pair/aspect keys have complete references and practices/questions. These checks do
not replace a human review of all wording. Sixteen reusable relationship rules limit
the variety of synthesis, and the English release has no localized prose or separate
retrograde interpretation. Those limits are explicit rather than filled with invented
personal claims. The rule/evidence contracts allow reviewed future packs to expand
coverage under new versions without changing a saved chart silently.
