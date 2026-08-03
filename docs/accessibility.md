# Without a mouse (#35)

Keyboard, focus, the named regions list and the district walk. `src/CLAUDE.md` carries the
rules; this file carries why each is shaped the way it is.

---

**Without a mouse (#35).** The two selectors have declared `role="radiogroup"` since #18, and that
is a promise about the **arrow keys** as much as about the accessible name — one that the markup
made and the behaviour did not keep until now. Each group is **one stop on the tab ring**, on
whatever is currently checked (tabbing through five bases and then eight variants to reach the map
is a journey nobody finishes), and the arrows move within it and select as they go, which is the
radio pattern rather than a shortcut: focus and selection travel together, and there is no state
here in which a basis is focused but not chosen (D13). They **wrap**, because a group that stops
dead leaves a reader pressing a live key that does nothing; and they **step over the three bases
that cannot be selected**, since `disabled` refuses focus and landing on one makes the key look
broken. Where a key lands is `lib/radio-group.ts`'s, under test.

Only the keys the group claims have their default suppressed. `Tab` still leaves, `Enter` still
activates, and **`Space` is never touched** — it is the compare gesture (#22), and taking it here
would undo the care `holdsCompare` already takes to leave it to the focused control. All three
readings were checked in a browser: `Space` on the Compare button toggles the hold once and does not
double-fire, `Space` held on the focused map holds the comparison and releases it, and `Space` on a
focused variant chip switches variants and does *not* compare.

**Focus is visible on every control**, at two pixels of the map's own ink — the chips, both action
buttons, the sheet's grip, the audit panel's summary and the map itself. Stated once, because a ring
that exists on some controls and not others is worse than none: it teaches a reader to trust it and
then loses them. **Not the accent**, which means *a proposed province* and nothing else (D14);
spending it here would put the loudest colour on the page under a cursor rather than on the one
thing that does not exist yet. `:focus-visible`, so a pointer user who clicks a chip is not given a
ring they did not ask for.

**The map's regions are named in words** (#35). `role="img"` means assistive technology reaches no
path inside the SVG — which is right, since 156 unlabelled shapes announced one at a time is noise
and not a map — but it leaves the graphic with a single accessible name for a whole country. So the
regions are named in a list beside it, available to a screen reader and never painted: an
*equivalent* rather than a pantomime of one, and a better answer than making 156 paths focusable,
which would hand a keyboard reader 156 stops and no way past them. Units replace provinces there
exactly as they do on the map, or a reader is given "Sindh" twice and left to work out whether that
is one place or two. The standing words are **the tooltip's own and are not written in the roster at all** — a current
unit's comes from `describeKind` and a proposed one's from `UNIT_STANDING`, both exported from
beside the tooltip, so a reader who hovers a district and then reads the list is never given two
different words for one constitutional fact. The test compares against those exports rather than
against a copy of the strings: pinned to a literal it would pass green with two vocabularies live,
which is the failure it exists to prevent. Not a live region: it describes what is on screen, and announcing
eight units on every variant change would talk over the readout that is actually answering them.

**The map is walkable with the keyboard** (#35), and this is the part of the ticket that matters
most. The readout is the only per-district surface a screen reader has, and everything that wrote to
it was a pointer — `pointermove` on a desktop, a tap on a phone — so a reader with no pointer could
focus the map and never make it say a word. Arrow keys now walk the districts from the focused map,
`Home` and `End` reach the ends, and `Escape` puts the readout away. Each stop goes through the same
`showDistrict` the pointer uses, so the wash, the tooltip and the spoken sentence cannot drift apart
— and the box is drawn as well as spoken, because a reader using a magnifier has a keyboard and eyes
both.

**The walk is a reading order, not a compass**, and is not pretended to be one. A spatial walk over
156 irregular polygons has no honest answer for "which district is left of Gwadar" at a coastline,
and a reader who cannot see the map cannot check the answer it invented. What they can rely on is an
order that is stable, complete and the same every time: province, then division, then district —
the administrative hierarchy the map is built on (D23), and the order the tooltip reads a district's
own address in. Bundle order would have been arc order, which puts a reader in Sindh, then Punjab,
then Sindh again. `Space` is refused by the walk as it is everywhere, so a reader can walk the
districts and still hold the country up against the proposal.

**An arrow key inside a group replaces its history entry rather than pushing one** (#23, #35). The
rule is the one `go` already followed — a hash the reader *chose* is history, a hash they merely
passed through is not — and an arrow key auto-repeats, so a reader scanning eight variants with a
held key would have to press Back eight times to leave a group they never meant to enter. A click is
still an entry, and so is the variant they stop on, because stopping is the choosing.
