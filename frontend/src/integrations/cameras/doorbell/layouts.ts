/**
 * Layout CSS for the doorbell page as broadsheet frames it, written against the
 * containment tree published in cam-proxy's `docs/theming.md`.
 *
 * This follows the approved mock, `docs/superpowers/designs/broadsheet/
 * doorbell.jsx` — the quick replies are numbered editorial responses on paper,
 * not filled buttons, and the actions are a mono pair beneath a rule. Three
 * constraints from the contract shape how it's written:
 *
 *  - **Never size anything from the reply count.** The set is user-configured
 *    and fetched after first paint, so a rail whose width comes from its
 *    children would resize the moment the list lands. `data-doorbell-reply-count`
 *    is *absent* until that fetch resolves — deliberately, so "none configured"
 *    and "don't know yet" can't be confused — which also means an empty-state
 *    rule keyed on `count="0"` does not match while loading. The numbering is a
 *    CSS counter for the same family of reasons: it renumbers itself for any
 *    count, where `nth-child` would be positioning by index.
 *  - **State rules are `(0,2,0)` compounds.** A bare `[data-doorbell="talk"]`
 *    override loses to `[data-doorbell="talk"][data-doorbell-talking]` while
 *    that state is active, so anything stateful is matched at the same
 *    specificity.
 *  - **The overlay is removed from the DOM 300ms after `live`.** Styling it for
 *    a later state has nothing to apply to.
 */
export const BROADSHEET_LAYOUT = `
/* The stats overlay's toggle has no place on a household screen. */
[data-doorbell="debug-toggle"] { display: none; }

/* The mic-error label is the raw browser string — Firefox's is a full
   sentence, and on an insecure origin \`getUserMedia\` is undefined so the
   message is a TypeError's text. Unclamped it blows the actions row out. */
[data-doorbell="talk"][data-doorbell-mic="denied"] {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-doorbell="root"] {
  background: var(--doorbell-bg);
  font-family: var(--doorbell-font-body);
}

[data-doorbell="layout"] {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100%;
  gap: 0;
}

/* The camera is portrait (480×640) in a wide frame, so the image sits on a
   ground rather than being stretched. That ground is most of the frame at this
   aspect, which rules out the mock's near-black \`#0a0805\` — at that size it
   reads as letterbox bars rather than as a chosen field.
   \`--doorbell-border\` is broadsheet's \`--rule-faint\`, the theme's lightest
   ink-on-paper tone. Used here as a surface rather than as a rule, which is a
   stretch of the name, but it's the right value and it follows the palette:
   restating the hex would drift the first time broadsheet is retuned. The
   cost of the light end is the night feed, which lands darker against it than
   it would against a deep ground. */
[data-doorbell="stage"] {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--doorbell-border);
}

[data-doorbell="video"] {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* The right rail. Fixed width, so the N=0 → N=4 transition on every load
   moves nothing. */
[data-doorbell="sidebar"] {
  flex: 0 0 320px;
  width: 320px;
  display: flex;
  flex-direction: column;
  padding: 16px 28px 16px 24px;
  background: var(--doorbell-bg);
  border-left: 1px solid var(--doorbell-border);
}

/* "Quick replies." — serif, ruled beneath, with the mock's mono kicker above
   it. The kicker is CSS-generated because the page owns its own markup and
   there's no element to put it in; it's decorative, and the heading it sits
   over already carries the meaning. */
[data-doorbell="replies-heading"] {
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--doorbell-text);
  font-family: var(--doorbell-font-display);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.05;
  color: var(--doorbell-text);
}

[data-doorbell="replies-heading"]::before {
  content: 'Speak from inside';
  display: block;
  margin-bottom: 6px;
  font-family: var(--doorbell-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--doorbell-danger);
}

[data-doorbell="replies"] {
  display: flex;
  flex-direction: column;
  gap: 10px;
  counter-reset: reply;
}

/* Outlined paper cards, not filled blocks: the mock sets each reply as a
   numbered item of editorial copy. */
[data-doorbell="reply"] {
  counter-increment: reply;
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 10px;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid var(--doorbell-border);
  border-radius: 0;
  background: var(--doorbell-surface);
  font-family: var(--doorbell-font-display);
  font-style: italic;
  font-size: 14px;
  line-height: 1.4;
  color: var(--doorbell-text);
  text-align: left;
}

[data-doorbell="reply"]::before {
  content: counter(reply, decimal-leading-zero);
  padding-top: 3px;
  font-family: var(--doorbell-font-mono);
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--doorbell-danger);
}

/* Compound, to beat the base sheet's own (0,2,0) playing rule. */
[data-doorbell="reply"][data-doorbell-playing] {
  background: var(--doorbell-success);
  color: var(--doorbell-accent-text);
}

[data-doorbell="reply"][data-doorbell-playing]::before {
  color: var(--doorbell-accent-text);
}

/* The actions sit at the foot of the rail under their own rule and kicker —
   the replies are a column you read down, this is the thing you reach for. */
[data-doorbell="controls"] {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--doorbell-border);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

[data-doorbell="controls"]::before {
  content: 'Open the line';
  grid-column: 1 / -1;
  font-family: var(--doorbell-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--doorbell-text-muted);
}

[data-doorbell="talk"], [data-doorbell="mute"] {
  border-radius: 0;
  padding: 14px 12px;
  font-family: var(--doorbell-font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-align: center;
  text-transform: uppercase;
}

/* Rust on paper — the one live action carries the spot colour. */
[data-doorbell="talk"] {
  background: var(--doorbell-danger);
  color: var(--doorbell-accent-text);
  border: none;
}

/* Filled is the *live* state, outlined is the resting one — the page ships
   with \`data-doorbell-muted\` already set, so the outlined treatment is what
   the mock actually shows and what's on screen almost all the time. Inverting
   these would make the resting look the loud one. */
[data-doorbell="mute"] {
  background: var(--doorbell-text);
  color: var(--doorbell-bg);
  border: 1px solid var(--doorbell-text);
}

[data-doorbell="mute"][data-doorbell-muted] {
  background: var(--doorbell-surface);
  color: var(--doorbell-text);
}

/* Matches the stage ground, so the reveal doesn't step tone as the overlay
   hands over to the video. */
[data-doorbell="overlay"] {
  background: var(--doorbell-border);
}

/* Ink on the light ground now, not paper — the overlay is no longer dark. */
[data-doorbell="overlay-text"] {
  font-family: var(--doorbell-font-display);
  font-style: italic;
  font-size: 18px;
  color: var(--doorbell-text);
}
`

/**
 * The ring popup's variant of the same page, per the mock
 * `docs/superpowers/designs/broadsheet/doorbell-alert.jsx` — the "stop press"
 * slip. Same arrangement as the Watch Room (feed left, replies in a rail) but
 * tightened: the slip's rail is 348px against the screen's 320, the type is a
 * notch smaller, and the parent supplies the frame and the rail's border, so
 * this styles only what sits inside them.
 *
 * The same three contract constraints apply as in `BROADSHEET_LAYOUT`: never
 * size from the reply count, match `(0,2,0)` for state rules, and don't style
 * the overlay for anything after `live`.
 */
export const BROADSHEET_RING_LAYOUT = `
[data-doorbell="debug-toggle"] { display: none; }

[data-doorbell="talk"][data-doorbell-mic="denied"] {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The slip already draws the feed's frame and the rail's rule, so the page
   itself is only the two panels sitting inside them. */
[data-doorbell="root"] {
  background: transparent;
  font-family: var(--doorbell-font-body);
}

[data-doorbell="layout"] {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100%;
  gap: 0;
}

/* The feed carries the mock's 7px inked frame. It has to be drawn here rather
   than by the slip: the slip only sees one iframe, and a border out there would
   enclose the replies rail too. */
[data-doorbell="stage"] {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 7px solid var(--doorbell-text);
  background: var(--doorbell-border);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.24);
}

[data-doorbell="video"] {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Fixed, so the N=0 → N=4 transition on every load moves nothing. */
[data-doorbell="sidebar"] {
  flex: 0 0 348px;
  width: 348px;
  display: flex;
  flex-direction: column;
  padding: 0 0 0 22px;
  margin-left: 22px;
  background: transparent;
  border-left: 1px solid var(--doorbell-border);
}

/* "Answer from inside" here, against the Watch Room's "Speak from inside" —
   the mock uses different words on the slip, and it's the better one: at this
   moment somebody is waiting for an answer. */
[data-doorbell="replies-heading"] {
  margin: 0 0 11px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--doorbell-text);
  font-family: var(--doorbell-font-display);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.05;
  color: var(--doorbell-text);
}

[data-doorbell="replies-heading"]::before {
  content: 'Answer from inside';
  display: block;
  margin-bottom: 5px;
  font-family: var(--doorbell-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--doorbell-danger);
}

[data-doorbell="replies"] {
  display: flex;
  flex-direction: column;
  gap: 7px;
  counter-reset: reply;
}

[data-doorbell="reply"] {
  counter-increment: reply;
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 9px;
  align-items: start;
  padding: 9px 11px;
  border: 1px solid var(--doorbell-border);
  border-radius: 0;
  background: var(--doorbell-surface);
  font-family: var(--doorbell-font-display);
  font-style: italic;
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--doorbell-text);
  text-align: left;
}

[data-doorbell="reply"]::before {
  content: counter(reply, decimal-leading-zero);
  padding-top: 3px;
  font-family: var(--doorbell-font-mono);
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--doorbell-danger);
}

[data-doorbell="reply"][data-doorbell-playing] {
  background: var(--doorbell-success);
  color: var(--doorbell-accent-text);
}

[data-doorbell="reply"][data-doorbell-playing]::before {
  color: var(--doorbell-accent-text);
}

/* The slip's own foot note sits below this rail, so the actions stop short of
   the bottom rather than reaching for it. */
[data-doorbell="controls"] {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--doorbell-border);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

[data-doorbell="talk"], [data-doorbell="mute"] {
  border-radius: 0;
  width: 100%;
  justify-self: stretch;
  padding: 13px 12px;
  font-family: var(--doorbell-font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-align: center;
  text-transform: uppercase;
}

[data-doorbell="talk"] {
  background: var(--doorbell-danger);
  color: var(--doorbell-accent-text);
  border: none;
}

[data-doorbell="mute"] {
  background: var(--doorbell-text);
  color: var(--doorbell-bg);
  border: 1px solid var(--doorbell-text);
}

[data-doorbell="mute"][data-doorbell-muted] {
  background: var(--doorbell-surface);
  color: var(--doorbell-text);
}

[data-doorbell="overlay"] {
  background: var(--doorbell-border);
}

[data-doorbell="overlay-text"] {
  font-family: var(--doorbell-font-display);
  font-style: italic;
  font-size: 18px;
  color: var(--doorbell-text);
}
`
