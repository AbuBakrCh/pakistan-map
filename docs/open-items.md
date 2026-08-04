# Open items

The full record, resolved items included. Root `CLAUDE.md` carries the live constraints —
what a variant may and may not do — and points here for the history behind each.

Numbered as they have always been; a resolved item keeps its number rather than being removed,
because the resolutions are cited by number elsewhere.

---

1. ~~**AJK district list** is from memory~~ — **resolved.** 10 districts in 3 divisions,
   confirmed against AJK BoS and PBS. The set was right; the *names* were not (officially
   **Jhelum Valley**, not Hattian Bala; **Sudhnoti**, not Sudhanoti) and Haveli sits in Poonch
   division, not Muzaffarabad. See `docs/research/ajk-district-set.md`.

   **Half of it was applied backwards for a year, and the correction is #46.** Sudhnoti landed;
   Jhelum Valley did not — the roster carried OSM's *Hattian Bala*, which is the headquarters
   town and the tehsil, and aliased the AJK government's own name onto it. So the app displayed
   the wrong name for the district on precisely the ground it is least free to get wrong. The
   fix costs nothing but a rebake, because the join was never on the name: every AJK district is
   pinned by relation id, so inverting the pair left the geometry byte-identical and moved 68
   strings in `scenarios.json`, four in `adjacency.json` — a key and three neighbour entries,
   since that graph is keyed on names — and every rendered surface behind them. What is new is
   the **guard**: `reconcile.test.ts` now asserts the rule in both
   directions — the alias's *value* is what is displayed, its *key* is only how somebody else
   spells it, and no alias key may normalize to a name the roster displays. That general rule
   catches the *half* inversion and **not** a clean one of both sides at once, which is a
   well-formed table saying the wrong thing; the named pair is what catches that, and the two
   are kept apart here rather than the guard being described as more than it is. **Neelum was checked
   with it and was half missing**: the canonical name was right, OSM's *Neelam Valley* was
   aliased, and the AJK Election Commission's *District Neelum Valley* was not. A canonical name
   being correct is no evidence that its aliases exist, which is why the two are asserted apart.

2. ~~**Balochistan's division and district set** needs verification~~ — **resolved.** 8
   divisions, 34 districts, proved complete by population sum. Surab is *not* new (draw it);
   Taftan is not a district at all. See `docs/research/balochistan-division-district-set.md`.
   The current-day 41-district roster remains unresolvable without the provincial gazette —
   which no longer blocks anything, since under ADR-0001 none of it is drawn.

2b. **Can a variant claim AJK or GB territory?** Those districts are drawn but unshaded and carry
   no PBS-direct statistics. Product decision outstanding — the
   build's provisional answer is **no**: `TERRITORY_CLAIM_POLICY` is `forbid`, so the first
   variant that needs it fails loudly naming the district instead of settling a constitutional
   question by accident. Both answers are expressible and both are tested.

   **Two narrowings have been made and neither is an answer to it.** Both take the *stated* reason
   for `forbid` — which is arithmetic, and only arithmetic — and observe that it does not reach a
   particular shape. Both are made out loud, tested at both seams, and asserted to fire for exactly
   the units they were written for, since an exclusion that never excludes anything passes a test
   perfectly. The question 2b actually asks is still open, and what still asks it is a hypothetical
   rather than a shipped variant: **a unit that carries population figures and reaches into ground
   the census does not cover.** Nothing in the app does that, and the build would refuse it by name.

   **A5 (#28) did not move it, and the reason is worth reading rather than assuming — the variant
   has since been retired and the narrowing it argued for has not.** A5 promoted both territories
   to provinces, which looks like the case this policy forbids and is not. The stated reason for `forbid` is arithmetic: those districts carry no PBS statistic, so a
   unit holding *some* of them has a population short by an unknowable amount and looks exactly
   like a unit whose population is right. That reason does not reach a unit that is **one
   territory's whole district set under that territory's own name** — nothing is taken from
   anybody, no boundary moves, and the population is not short but absent, which the scorecard
   already sets aside by name exactly as it does for a `territory` unit. So `promotedTerritoryOf`
   in `scenarios.ts` admits that one shape and the policy is untouched. Three conditions, each
   load-bearing: **exactly one territory** (nine of GB's ten is reaching in), **whole** (ten of
   them plus a Punjab district is a population that is short), and **under its own name** (moved
   districts are decided on a unit's name, so a territory promoted *and* renamed would read as ten
   districts changing hands when none has, and is refused rather than counted wrongly). The
   narrowing is a change to what counts as a *claim*, made out loud and tested at both seams.

   **Retiring A5 leaves the carve-out exercised by nothing, and that is now asserted.** It stays,
   because deleting it would answer a constitutional question by tidying up after an unrelated
   content decision, and because both answers to 2b are meant to stay expressible. What the suite
   holds instead is that **no shipped unit is a promotion** — so one arriving later arrives in a
   diff somebody read, rather than by a variant quietly finding the door open.

   **H2 (#30) is the second, and it is the wider of the two.** It draws Hunza and Nagar as the
   princely states they were, and both are Gilgit-Baltistan districts today — two of ten, so
   `promotedTerritoryOf` does not reach them and should not: a promotion is a change of standing,
   and this is a demarcation predating the territory it sits inside. What admits them is
   `withoutModernFigures`: H2 publishes **no population figure anywhere**, so it has no unit whose
   population can be short by an unknowable amount, and the arithmetic reason has nothing to
   protect. Unlike the promotion carve-out this one is about the *variant* rather than the unit, so
   it admits any shape of territory claim on a variant that withholds — stated here rather than
   discovered later. What keeps it honest is that withholding is a declaration with a reason
   printed on the card where the figures would be, and that the reason is checked: a variant may
   not buy the exception with a blank field, and a variant that carries figures is refused exactly
   as before.

3. **Deployment target** — deliberately undecided. Static bundle, builds to `dist/`.

4. ~~**`SCENARIOS-DRAFT.md` is temporary.**~~ — **resolved (#36).** The typed data module
   (`scripts/lib/variants.ts`, schema in `scripts/lib/scenarios.ts`) carried all seventeen variants
   when this was resolved — fourteen now, the four rule-drawn Administrative maps having been
   retired for the one that draws inside the existing provinces — D1 last (#31), and the markdown is
   **deleted** — recoverable at
   `git show 20c2f67:SCENARIOS-DRAFT.md`, deleted in `728faf0`. Keeping both would have been two
   sources of truth, and the draft had already drifted from the build in the one place it mattered
   most: it named the third development indicator "improved sanitation", which is a column PBS does
   not publish, and the shipped basis shades by the flush-toilet share and says so.

   **The deletion was made before the audit that should have gated it, so the audit was done
   afterwards and written down**: `docs/research/scenario-migration.md` reconciles all seventeen
   variants field by field — rationale, status, boundary provenance, advocates, opposition,
   alternative names, units, footnotes and sources — and separates the three outcomes by name.
   *Carried*, which is nearly all of it. *Drift*, nine places where the two disagree and the module
   is right, each recorded rather than "restored", since restoring a falsehood is not migration:
   the sanitation column above, A1's "~9 units" against the 16 the ceiling actually cost — a
   drift recorded against a variant since retired, and kept here because the record is of what the
   draft said rather than of what is currently built — D1's
   claim to reproduce three regions when it reproduces one, five unit counts that counted only the
   units their prose was about (H1, H3, H4, A5 and L7, the last also predicting three Balochi
   regions where the rule finds two), L7's badge,
   L3's Waziristan percentage, A5's "26th Amendment" — a number since taken by a different
   instrument — and two political assertions narrowed to what a source carries. And *not migrated*,
   the draft-process material that is not variant content, each with its reason, the largest being
   two anchoring figures that would have had to be asserted without a source. **Nothing in the draft
   was found to be content the module lacks**, so nothing was restored into `variants.ts`; what the
   audit added is the record, and a suite check so the claim does not depend on it being re-read.

5. **`GB` as Gilgit-Baltistan's short form is unconfirmed.** Added for #34, where the alternative
   was leaving the territory drawn and anonymous at 390px — the one thing the politically sensitive
   rendering section forbids. Every other entry in `SHORT_FORMS` names a publishing agency; this one
   rests on general usage by the territory's own government and assembly. It wants the treatment
   open item 1 gave AJK's district names: a check against a published document, recorded in
   `docs/research/`. Related, and the owner's call rather than the build's: **what H3's advocates
   call the *Northern Areas* short**, what H2's ***Gilgit Agency and Baltistan*** is called short —
   at 279px the longest unit name in the app (#30) — and what L7's *Pushto (Keamari)* and
   *Kohiostani* are called short.

   **None of those four is a name the app now fails to set**, and the item is kept open anyway. All
   four are named at the 390px bar as things stand — a name that will not fit its ground goes out on
   a leader, and the leader may now travel — so this is no longer a legibility gap but a provenance
   one: a short form is what a reader sees where the ground is small, and `GB` is the one entry in
   the table resting on general usage rather than on a document.

   **D1's six unnamed units at the bar are not this open item**, and filing them here would be asking
   a question with no one to answer it (#28, #31). A rule-drawn unit has no advocates to have a short
   form: the engine names each after its most populous district, so *South Waziristan* and *Karachi
   East* are already the shortest true names those units have. Nothing is outstanding — thirty-five
   units on a 369px-wide country is more than the paper holds, which is stated where the labelling
   doctrine is rather than left waiting on a source that does not exist. **A6's one unnamed unit is
   not this item either, and for the same reason twice over**: *Islamabad* is a rule-drawn unit with
   no advocates, and it is already the shortest true name that ground has.

6. **The method note has three gaps, and all three are content rather than machinery** (#52). The box that
   says how the map on screen was built is on the paper, under test, and written for three of the four
   bases. What is outstanding:

   **Historical has no summary.** All four of its variants are drawn and none of them says how it was
   arrived at, which is the same basis that is still short of a fill. The suite asserts the absence by
   name, so it cannot be forgotten and cannot be half-filled — but the box simply does not draw for
   H1 to H4, and a reader looking at the map of 1947 gets no sentence saying where those lines came
   from.

   **The Language basis's shared paragraph describes a rule five of its seven variants were not drawn
   by.** It states census plurality — neighbouring districts grouped where the same mother tongue is
   the majority — which is exactly how **L6 and L7** were derived, and is *not* how L1 to L5 were got:
   those five are transcribed, and follow the South Punjab Secretariat's existing boundary, the PPP's
   own district list, Hazara Division and Karachi Division. Each of the five says so in its own
   paragraph, so the box is not wrong on the variant — but the shared paragraph above it reads as a
   claim that this app grouped the districts, on maps it copied from advocates. It wants rewording to
   the ground these proposals are *argued on* rather than the method we drew them by, and the wording
   is the owner's. The same question is smaller but live on **Development**: the shared paragraph says
   districts of similar development levels are brought together, where D1's rule actually grows each
   unit around its **most populous** district to a threshold this project defines.

   **It is not drawn at 390px**, with the two keys — and unlike them, this is a loss. Their rows are
   repeated in full by the legend under the frame; this prose is on no other surface, so a phone
   reader gets no answer to *how was this line got* at all. What it wants is a home in the column
   below the map rather than a box on the paper, which is what the card and the legend already do
   there. Until it has one, the hard bar's readers are the ones short of it, which is the wrong way
   round for a project whose bar is a phone.

---

**Scenario content: 17 variants approved, 14 built** — Language 7, Administrative 2, Historical 4,
Development 1. The three the count is short by are A2, A3 and A4, retired alongside A1 when the
Administrative rule was restated to draw inside the existing provinces; the suite holds the
approved set against the built one with the retirement named, so nothing goes missing quietly.
Nothing else is outstanding, and `SCENARIOS-DRAFT.md` is deleted (#36): the typed module
is the only source of scenario content, and `docs/research/scenario-migration.md` is the
variant-by-variant record of what the draft said and where it went. H2 omits Amb and Phulra (sub-district, cannot be drawn
without inventing a boundary) and names both on the card. Karachi and Pashtun Balochistan are
attributed variants, not algorithmic by-products.
