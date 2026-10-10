# HS Pharma — Layout and Theme Research

**Design system name:** Pine & Paper
**Targets:** laptop (1366×768 up to 1920×1080), tablet, phone (360×640 up)
**Built on:** your *Frontend Research Report* (commit `d3181ba`) and the first demo, `hs-pharma-demo.html`

**How claims are labelled**

| Label | Meaning |
|---|---|
| **[Report]** | Taken from your frontend research report |
| **[Rec]** | My design recommendation (judgment plus established guidelines) |
| **[Confirm]** | Needs checking with you or the shop before building |

All contrast ratios in this file were calculated, not estimated. Nothing here has been tested with real cashiers; section 12 says how to do that.

---

## Contents

1. [The recommendation in one page](#1-the-recommendation-in-one-page)
2. [Who uses it, and where](#2-who-uses-it-and-where)
3. [Design direction](#3-design-direction)
4. [Theme: colour](#4-theme-colour)
5. [Theme: status language](#5-theme-status-language)
6. [Theme: type, space, shape, motion](#6-theme-type-space-shape-motion)
7. [Layout system and breakpoints](#7-layout-system-and-breakpoints)
8. [Screen layouts](#8-screen-layouts)
9. [Component rules](#9-component-rules)
10. [Pharmacy-specific rules](#10-pharmacy-specific-rules)
11. [Accessibility and performance](#11-accessibility-and-performance)
12. [Rollout and testing](#12-rollout-and-testing)
13. [Limits of this research](#13-limits-of-this-research)

Appendices: [A. Tokens as CSS](#appendix-a-tokens-as-css) · [B. Problems in the first demo](#appendix-b-problems-in-the-first-demo)

---

## 1. The recommendation in one page

**One idea:** the bill is the product. The screen a cashier looks at hundreds of times a day should feel like the receipt the customer takes home. Everything else stays calm, green and quiet so that the bill, and anything dangerous (an expired batch, a controlled drug, a customer over their credit limit), is what you notice.

| Decision | Choice | Why |
|---|---|---|
| Colour | Pine green structure, cool paper-grey surfaces, **one** burnt-orange action colour | Keeps your existing green and orange identity **[Report]**, fixes its contrast |
| Memorable element | The bill panel styled as a till receipt (cream paper, dashed rules, torn edge) | The only place cream appears. It is the one bold choice |
| Status | Colour **plus** icon **plus** words, always | About 1 in 12 men have some colour-vision deficiency, and shop lighting is poor **[Rec]** |
| Laptop layout | Left rail, slim top bar, two-pane Billing (search left, bill right), table-heavy elsewhere | Matches F2/F9 keyboard flow **[Report]** |
| Mobile layout | Bottom tab bar, search-first Billing, floating bill bar that opens a bottom sheet | Thumb reach. Commit sits at the bottom of the screen |
| Tables on phones | Become two-line rows or cards. Never horizontal scrolling for core flows | Readable at 360 px |
| Dialogs on phones | Full-screen sheets | Replaces centred modals that fall off small screens |
| Navigation model | Real URLs (use the `react-router-dom` you already installed) | Today the phone back button leaves the app **[Report 4.1]** |
| Dashboard | Opens with "Needs attention", not a KPI grid | A pharmacist's first question is what is expiring, not what is the total |

---

## 2. Who uses it, and where

| Person | Device (assumed) | Main job | Speed vs care |
|---|---|---|---|
| **Cashier** | Shop laptop or all-in-one, USB barcode scanner, keyboard | Sell fast, dozens of bills an hour | Speed, with hard stops on danger |
| **Manager** | Laptop at the counter, sometimes phone | Stock checks, returns, closing | Balanced |
| **Owner** | Phone away from the shop, laptop at home | Revenue, profit, expenses, udhaar | Glanceable summaries |

Roles are `owner | manager | cashier` **[Report 4.2]**. Cashier navigation is the smallest, so it must be the fastest.

**Assumptions to confirm [Confirm]**

- Shop laptops are often 1366×768 with a short usable height once browser toolbars take their share. I design for this as the **hardest laptop case**, because if Billing works there it works everywhere.
- The owner checks the app on a phone. If nobody does, mobile can be lower priority, but the phone layout below is still the safest way to make the app work on tablets.
- Bills may need to be printed on an 80 mm thermal printer. Check the model.
- Some customers or staff may prefer Urdu. See 10.4.

---

## 3. Design direction

### 3.1 Principles

1. **Safety before speed.** Anything that can hurt a patient or the business is impossible to miss and hard to do by accident: expired batches, controlled drugs, over-limit udhaar, discounts above role limits.
2. **One primary action per screen.** Orange means "this is the thing to do now" and nothing else.
3. **The receipt is the hero.** Spend boldness on the bill panel. Keep the rest disciplined.
4. **Dense on laptop, generous on touch.** Same features and same data, different density.
5. **Never colour alone.** Every status has an icon and words.
6. **Say what happens.** Buttons name the action and the amount. Errors say what went wrong and how to fix it.

### 3.2 Design plan, reviewed against the defaults

A short plan first, then what I changed after checking it against the clichés that appear in most generated designs.

| Axis | Plan |
|---|---|
| Colour | Pine `#0C3A2B` structure, leaf `#1B6B4F` interactive, paper `#F4F6F2` ground, receipt cream `#FFFDF6` (bill panel only), burnt orange `#C2410C` action |
| Type | Bricolage Grotesque for headings and the bill total, Figtree for everything else (both already in your app **[Report 4.6]**) |
| Layout | Rail + top bar + content. Billing is two panes. Phones swap the rail for a tab bar and the bill pane for a bottom sheet |
| Principles | Section 3.1 |

**What I rejected or changed, and why**

| Instinct | Changed to | Reason |
|---|---|---|
| Brand orange `#F26A1B` with white text | `#C2410C` for any orange that carries text | White on `#F26A1B` is **3.06:1**, which fails the 4.5:1 AA minimum. `#C2410C` gives **5.18:1**. The brighter orange survives as a logo mark only |
| Cream page background with a clay accent (very common look) | Cool green-grey paper `#F4F6F2`. Cream only on the bill | Keeps the receipt as the one distinctive moment |
| KPI-tile grid as the dashboard hero | "Needs attention" list first, sales second | The pharmacy's job is risk control, not reporting |
| Tracked all-caps labels above every section | Sentence-case labels, only where they help | Avoids template chrome |
| Monospace for data labels | Tabular numerals in the body font | Aligned money without a third typeface |
| Identical rounded cards everywhere | Three radii by role (6 / 10 / 16) and borders instead of shadows | Hierarchy through shape |
| Gradient washes as decoration | Gradient only on the login screen, as it is today **[Report 4.6]** | One place, kept for brand continuity |
| Scattered fade-in animations | One orchestrated moment: the bill "prints" on commit | Motion that answers an action |

---

## 4. Theme: colour

### 4.1 Core palette (light)

| Token | Hex | Role |
|---|---|---|
| `--pine` | `#0C3A2B` | Rail, login background, strongest brand surface |
| `--leaf` | `#1B6B4F` | Links, active nav, secondary buttons, focus-adjacent accents |
| `--paper` | `#F4F6F2` | Page background |
| `--surface` | `#FFFFFF` | Cards, tables, inputs |
| `--receipt` | `#FFFDF6` | **Bill panel only** |
| `--ink` | `#17231D` | Body text |
| `--ink-muted` | `#5B6B62` | Secondary text |
| `--action` | `#C2410C` | The single primary action per screen |
| `--border` | `#DFE5DF` | Decorative dividers only (see 4.3) |
| `--border-input` | `#7A8B81` | Input and control outlines |

### 4.2 Dark theme

Pharmacies are often dim in the evening, so dark mode is a working feature, not a nicety. Follow the system setting, with a manual toggle in the top bar.

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#0E1612` | Page |
| `--surface` | `#16211B` | Cards, tables |
| `--receipt` | `#1C261F` | Bill panel (still a different tone from the page) |
| `--ink` | `#E8EFE9` | Body text |
| `--ink-muted` | `#93A39A` | Secondary text |
| `--leaf` | `#4FB68A` | Interactive, lightened for dark |
| `--action` | `#FF8A4C` | Primary action, **with dark text** `#1A0E05` |
| `--border-input` | `#6B8074` | Control outlines |

Note that the dark action button flips to dark text on light orange. White on the same orange family only reaches 3.58:1.

### 4.3 Contrast, calculated

WCAG 2.2 AA needs **4.5:1** for normal text and **3:1** for large text and for the outlines of controls.

| Pair | Ratio | Result |
|---|---|---|
| Ink on paper | 14.92 | Pass |
| Ink on surface | 16.22 | Pass |
| Muted on paper | 5.19 | Pass |
| Muted on surface | 5.64 | Pass |
| White on leaf | 6.44 | Pass |
| White on pine | 12.68 | Pass |
| Rail text `#CFE3D8` on pine | 9.44 | Pass |
| White on action `#C2410C` | 5.18 | Pass |
| OK text on OK tint | 4.63 | Pass (tight, do not lighten) |
| Warning text `#8A5200` on tint | 5.66 | Pass |
| Error text on tint | 5.41 | Pass |
| Rx text on tint | 7.07 | Pass |
| Input border `#7A8B81` on white | 3.60 | Pass (3:1 needed) |
| Dark: ink on surface | 14.17 | Pass |
| Dark: muted on surface | 6.27 | Pass |
| Dark: leaf on surface | 6.62 | Pass |
| Dark: dark text on action | 8.11 | Pass |
| Dark: input border on surface | 3.92 | Pass |

**Fails to avoid:** the decorative border `#DFE5DF` is only **1.28:1** against white, which is fine for dividers between table rows but **not** for an input outline. That is why inputs use `--border-input`.

### 4.4 Colour rules

- About 70 percent neutral surfaces, 20 percent pine and leaf, **under 10 percent orange**.
- Orange appears on **one** button per screen. Never on a status.
- Status colours (4.5) mean status and nothing else. Never decorate with green or red.
- Charts use leaf, a neutral grey, and one accent. Do not use red or green as the only difference between two bars.

---

## 5. Theme: status language

Every status carries colour, an icon and words. The icons are simple inline SVGs, so there is no icon library to add.

### 5.1 Expiry

The report says expiry colouring comes from `daysUntil()` and `expiryClass()` **[Report 4.5]**, but the thresholds were not visible. Recommended four-step ladder **[Rec]**:

| State | Rule | Look | Behaviour |
|---|---|---|---|
| **Expired** | under 0 days | Solid red fill, white text, ✕ "Expired 12 days ago" | Batch **cannot** be added to a bill. Greyed out in the batch picker |
| **Urgent** | 0–30 days | Red tint, ! "24 days left" | Can be sold, always the first batch offered (FEFO). Gentle toast on add |
| **Soon** | 31–90 days | Amber tint, ◐ "62 days left" | Normal. Listed in "Needs attention" |
| **OK** | over 90 days | Green tint, ✓ "Exp 03/28" | Normal |

Make the two day-thresholds a setting **[Confirm]**. Some shops want 120 days for slow movers.

### 5.2 Other states

| Thing | States | Look |
|---|---|---|
| **Stock level** | Healthy, Low (below reorder point), Out | Thin bar under the quantity. Low gets amber ◐ and the words "Reorder" |
| **Udhaar balance** | Under 80 percent of limit, 80 percent and over, Over limit | Bar + pill. At 80 percent the pill turns amber. **Over limit blocks the sale** with a clear message |
| **Rx** | Prescription needed | Purple pill "Rx" |
| **Controlled** | Controlled narcotic (Form-9) | Purple pill "Controlled" **and** a purple left edge on its bill line, so it is unmissable |
| **Sale** | Committed, Voided, Returned | Green, grey with strike-through, amber |
| **Compliance** | Computed from the register | "All entries complete" (green) or "2 entries need attention" (red) **[Report 8.5]** |
| **Connection** | Online, Offline, Syncing | Small dot and word in the top bar. Matters because the app is a PWA **[Report 2]** |

---

## 6. Theme: type, space, shape, motion

### 6.1 Type

| Role | Family | Why |
|---|---|---|
| Headings, bill total, page titles | **Bricolage Grotesque** 600/700 | Already in your app. Has character at large sizes |
| Body, tables, forms, buttons | **Figtree** 400/500/600 | Already in your app. Clear at small sizes |
| Fallback | `system-ui, "Segoe UI", Roboto, sans-serif` | Shop hardware may block or slow web fonts |

Set `font-display: swap` and subset to Latin. Do not load more than four font files.

**Scale** (laptop / phone). Line length stays under 75 characters.

| Step | Laptop | Phone | Use |
|---|---|---|---|
| Caption | 12.5 px | 13 px | Batch numbers, hints |
| Dense | 14 px | 15 px | Table rows on laptop |
| Body | 15 px | **16 px** | Default text |
| Label | 14 px / 600 | 15 px / 600 | Field labels, tabs |
| Section | 18 px | 18 px | Card titles |
| Page title | 22 px | 20 px | Top bar |
| Bill total | 32 px | 34 px | The amount due |

Phone inputs must be **16 px or larger**, otherwise iOS Safari zooms the page when a field is focused.

**Money:** use `font-variant-numeric: tabular-nums` on every amount so columns line up. Check that Figtree and Bricolage ship tabular figures **[Confirm]**. If not, set amounts in the system font only.

Use **one** money formatter everywhere. The report notes `en-IN` grouping on the drawer chip **[Report 4.5]**, which gives lakh-style grouping such as `Rs 5,40,000`, the way shopkeepers read numbers. Show whole rupees on bills and decimals only in cost and margin fields.

### 6.2 Space and shape

| Token | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 20, 24, 32, 48 px |
| Radius, controls | 6 px |
| Radius, cards | 10 px |
| Radius, sheets and modals | 16 px (top corners only on phones) |
| Radius, pills and chips | fully round |
| Bill panel | 4 px top, **torn bottom edge** |
| Elevation | None on cards (use a 1 px border). Shadow only on overlays: sheet, palette, toast |
| Touch target | **44×44 px minimum** on phones, 36 px minimum on laptop |
| Row height | 48 px on phones, 40 px dense on laptop |

### 6.3 Motion

Motion happens **only** in answer to something the person did.

| Moment | Motion | Time |
|---|---|---|
| Item added to bill | Row highlights then settles, count in the bill bar ticks up | 200 ms |
| Sheet opens or closes | Slide from bottom | 220 ms |
| **Sale committed** | The bill panel "prints" down and out. This is the one orchestrated moment | 450 ms |
| Toast | Fade in, auto-dismiss | 150 ms in, 2.6 s hold |

Everything is switched off under `prefers-reduced-motion`. No decorative page-load animation, no hover lift on cards.

### 6.4 Icons

A 20×20 inline SVG sprite, 1.75 px stroke, about 24 icons (cart, search, scan, box, users, shield-check, alert, clock, x, check, printer, more). Never an icon alone. Every icon button has a text label or `aria-label`.

---

## 7. Layout system and breakpoints

### 7.1 Breakpoints

| Name | Width | Typical device | Navigation | Content |
|---|---|---|---|---|
| **xs** | under 480 | Phone, portrait (360–430) | Bottom tab bar | One column |
| **sm** | 480–767 | Large phone, phone landscape | Bottom tab bar | One column, wider cards |
| **md** | 768–1023 | Tablet portrait | Icon rail (68 px) | One or two columns |
| **lg** | 1024–1279 | Small laptop, tablet landscape | Icon rail (68 px) | Billing becomes two panes |
| **xl** | 1280–1599 | Standard laptop (1366, 1440) | **Full rail (224 px)** | Two panes, tables |
| **2xl** | 1600 and up | Desktop 1920 | Full rail | Same, with a content max-width of 1440 px (Billing is exempt and fills the width) |

Use `min-width` media queries, mobile first. Remember the user's saved rail state (`hs_sidebar_collapsed`) **[Report 4.7]** overrides the automatic choice on laptops.

### 7.2 Shell

| Zone | Laptop | Phone |
|---|---|---|
| Navigation | Left rail, grouped (7.3) | Bottom tab bar, 5 slots, safe-area aware |
| Top bar | Page title, alert chips, sound toggle, search (Ctrl/Cmd+K), theme, user | Page title, search icon, alert dot, user in "More" |
| Content | Scrolls inside the shell. Shell never scrolls | Scrolls under a sticky top bar |
| Overlays | Centred modal, side drawer for ledgers | **Full-screen sheet** |

### 7.3 Navigation grouping

The app has ten flat screens **[Report 4.1]**. Group them by the job being done **[Rec]**:

| Group | Screens | Roles |
|---|---|---|
| **Sell** | Billing (default), Sales history | All |
| **Stock** | Stock, Medicines, Purchases | Manager, owner (Medicines read-only for cashier **[Confirm]**) |
| **People** | Customers (udhaar) | All |
| **Money** | Dashboard, Revenue, Closing | Dashboard all, Revenue and Closing manager and owner, expenses owner only |
| **Compliance** | Narcotics register | Manager, owner |

Group titles are small sentence-case text in the rail. They disappear when the rail collapses.

**Phone tab bar** (role-aware **[Confirm]** against your `NAV_ITEMS`):

| Role | Tabs |
|---|---|
| Cashier | Billing · Sales · Customers · Dashboard · More |
| Manager | Billing · Stock · Customers · Dashboard · More |
| Owner | Dashboard · Billing · Stock · Customers · More |

"More" opens a sheet with everything else, plus theme, sound and sign out.

### 7.4 Core layout CSS

```css
/* App shell: rail + main. Phones put the nav at the bottom instead. */
.app{display:grid;grid-template-columns:1fr;grid-template-rows:1fr auto;height:100dvh}
.rail{display:none}
.tabbar{grid-row:2;display:flex;padding-bottom:env(safe-area-inset-bottom)}
@media (min-width:768px){
  .app{grid-template-columns:68px 1fr;grid-template-rows:1fr}
  .rail{display:flex}.tabbar{display:none}
}
@media (min-width:1280px){.app{grid-template-columns:224px 1fr}}
.app.collapsed{grid-template-columns:68px 1fr}   /* user override */

/* Billing: stacked on phones, two panes from 1024 */
.pos{display:grid;gap:16px}
@media (min-width:1024px){
  .pos{grid-template-columns:minmax(0,1fr) clamp(340px,30vw,420px);height:100%}
  .pos-search{overflow:auto}
  .till{display:grid;grid-template-rows:auto 1fr auto;min-height:0} /* header / scrolling lines / pinned totals */
}
```

Use `100dvh` rather than `100vh` so mobile browser toolbars do not cut off the bottom of the screen.

---

## 8. Screen layouts

### 8.1 Billing (the hero screen)

#### Laptop, 1366×768 (the hard case)

Usable height is roughly 600 px under the top bar and browser toolbars, so the layout has to budget it. The **totals and Commit stay pinned at the bottom of the bill**, and only the line items scroll. In the first demo the Commit button could scroll out of view. That is the most important fix in this file.

```
┌──────────┬─────────────────────────────────────────────────────────────────┐
│ ▣ HS     │ Billing        ▲ 3 low   ✕ 2 expiring   Drawer Rs 5,40,000  ⌘K ◐│ 52
│  Pharma  ├───────────────────────────────────────────┬─────────────────────┤
│ Sell     │ ┌───────────────────────────────────────┐ │ Current bill  #1046 │
│  ▸Billing│ │ ⌕ Search medicine or scan barcode  F2 │ │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│  Sales   │ └───────────────────────────────────────┘ │ Panadol 500mg Rs 60 │
│ Stock    │ Panadol 500mg            Rs 60 / 10        │  B2291  [-] 10 [+]  │
│  Stock   │  ✓ B2291 · 260 left · first to sell        │ Tramal 50mg  Rs 360 │ ← purple edge
│  Medicines│ ✓ B2310 · 120 left                        │  TR90   [-] 10 [+]  │
│ People   │ Augmentin 625mg  [Rx]    Rs 980 / 6        │          (scrolls)  │
│  Customers│ ! B1 · 55 days · 30 left                  │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ Money    │ ...                                        │ Discount %   [ 0 ]  │
│  Dashboard│                                           │ Total      Rs 420   │
│ Compliance│                                           │ [Cash][Card][Udhaar]│
│  Narcotics│                                           │ ┌─────────────────┐ │
│          │                                            │ │ Commit  Rs 420  │ │ ← orange, F9
│ « Collapse│                                           │ └─────────────────┘ │
└──────────┴───────────────────────────────────────────┴─────────────────────┘
   224 px            ≈ 700 px results                         380 px bill
```

**Height budget** (768 px screen, roughly 600 px usable): bill header 44, scrolling lines about 250, discount and totals 120, payment 44, Commit 52, gaps 40. If the cart grows, only the lines scroll.

**Rules**

- Search owns the left pane. Results are **dense rows** (40–48 px), with batches as chips inside the row. Show at most the first six batches, "more" opens the rest.
- The first unexpired batch is marked "first to sell" (FEFO) and is the default when someone presses Enter on a result **[Report 4.4, 5.1]**.
- Barcode scan adds the first-to-sell batch directly and plays `sounds.scan()`.
- `F2` focuses search. `F9` commits. `Esc` clears the search. `Ctrl/Cmd+K` opens the palette.
- Cash received lives under the payment chips. Show the change in large type once enough cash is typed.
- Discount input **clamps** at the role limit (100 / 15 / 5 percent) and tells the person why **[Report 8.4]**. A server check is still required.
- A controlled drug line has a purple left edge. Pressing Commit opens the patient and prescriber sheet first **[Report 5.1]**.

#### Phone, 360×640

```
┌──────────────────────────┐
│ Billing        ⌕   ▲3   │ 52  top bar
├──────────────────────────┤
│ ┌──────────────────┬───┐ │
│ │ Search medicine  │ ▣ │ │ 48  ▣ = camera scan
│ └──────────────────┴───┘ │
│ Panadol 500mg            │
│ Rs 60 per pack of 10     │
│ [B2291 · 260 · ✓ OK ]    │ 44  tap = add
│ [B2310 · 120 · ✓ OK ]    │
│ ──────────────────────── │
│ Augmentin 625mg   [Rx]   │
│ [B1 · 30 · ! 55 days]    │
│ ...                      │
├──────────────────────────┤
│ 3 items · Rs 420  View ▲ │ 56  floating bill bar
├──────────────────────────┤
│ Bill  Stock  Cust  Dash ⋯│ 56  tab bar
└──────────────────────────┘
```

Tapping the bill bar opens a **bottom sheet** in two heights:

```
┌──────────────────────────┐
│          ───             │  drag handle
│ Current bill  #1046   ✕ │
│ Panadol 500   Rs 60      │
│  [-] 10 [+]       🗑 ... │  44 px steppers
│ Tramal 50mg ▌Rs 360      │  purple edge = controlled
│ Discount %       [ 0 ]   │
│ Total           Rs 420   │
│ [Cash] [Card] [Udhaar]   │
│ ┌──────────────────────┐ │
│ │ Commit sale · Rs 420 │ │  52 px, orange, thumb zone
│ └──────────────────────┘ │
└──────────────────────────┘
```

- **Camera scan** button: your report says `@zxing/browser` is installed but unused, and the README advertises camera scanning **[Report 9]**. The search field is the right home for it. On laptops with a USB scanner, the scanner types into search as today.
- Optional: `navigator.vibrate(30)` on scan (Android only), alongside the sound.
- Never put the Commit button inside the scrolling content. It is always pinned.

#### Tablet landscape (1024×768)

Same two panes as laptop with the rail collapsed to icons. In portrait, use the phone layout with a wider sheet.

### 8.2 Dashboard

**Laptop:** a "Needs attention" column first, with the business numbers beside it.

```
┌─────────────────────────────────────────┬────────────────────────────────┐
│ Needs attention                         │ Today                          │
│ ✕ Brufen 400mg · batch BR17 expired     │ Sales        Rs 4,73,000       │
│   [Write off]                           │ Profit       Rs 1,04,000  (owner)│
│ ! Augmentin 625mg · 55 days · 30 left   │ ▇▇▇▇▇▇▇▇▇░▒▒▒  cash/card/udhaar│
│   [Return to supplier]                  │ Udhaar owed  Rs 60,36,000      │
│ ◐ Risek 40mg · 18 left (reorder at 20)  ├────────────────────────────────┤
│   [Add to purchase]                     │ Recent sales                   │
│ ! Imran Medical Store · 86% of limit    │ INV-1045  11:18  cash  Rs 1,240│
│   [View ledger]                         │ INV-1044  10:31  cash    Rs 230│
└─────────────────────────────────────────┴────────────────────────────────┘
```

**Phone:** a single column in this order: attention items (collapsed to three, "see all"), today's total with the payment split bar, udhaar owed, recent sales. Owner-only profit appears only for owners **[Report 5]**.

Every attention item has **one** action button. The list is built from the same cached queries the top-bar chips use, so nothing extra is fetched **[Report 4.3]**.

### 8.3 Other screens

| Screen | Laptop | Phone |
|---|---|---|
| **Login** | Centred card on the pine gradient, logo mark in bright orange, role is derived from the account, not picked | Same card, full width with 20 px margins |
| **Sales history** | Tabs (invoices / customer returns), filter bar above a table, row opens a side drawer with items, print and void | Filters collapse into a "Filter" sheet. Rows become two lines: invoice and total, then time and status. Row opens a full-screen sheet |
| **Revenue** | Period selector, 12-tile KPI grid in 4 columns, charts below, top medicines and customers side by side | Period selector scrolls horizontally. KPIs in 2 columns, charts full width, tables become ranked lists |
| **Closing** | Two columns: note-denomination calculator on the left, expected-vs-counted summary pinned on the right | Single column. Summary sticks to the bottom with the short/over badge and "Close drawer" |
| **Medicines** | Dense table with search, filters, "Add medicine" opens a wide modal with live unit cost and margin side by side | Cards with name, generic, price and stock. "Add medicine" opens a full-screen form in three steps (basics, pricing, opening stock) |
| **Purchases** | Tabs (invoices / debit notes), "New purchase" modal | Same as Sales history pattern |
| **Customers** | Table with balance pill and credit bar, ledger in a right-hand drawer | Cards. Tap opens ledger sheet with "Receive payment" pinned at the bottom |
| **Stock** | Tabs: Near expiry, Low stock, Expired, Audits. Row actions inline | Tabs scroll horizontally. Each row is a card with the expiry chip and a primary action |
| **Narcotics** | Summary cards (including the **computed** compliance check), filter bar, wide register table, print official register | Cards per entry. Missing CNIC or prescriber number shown as a red "Missing" chip. Print opens the official register |

**Table to phone conversion rule** **[Rec]**

1. Pick at most three facts that matter (what it is, how much, what state).
2. Show them as a two-line row with the state chip on the right.
3. Everything else lives behind a tap, in a full-screen sheet.
4. Do not scroll horizontally on core screens (Billing, Stock, Customers). Wide report tables, such as the Form-9 register, may scroll inside their own container.

---

## 9. Component rules

| Component | Rule |
|---|---|
| **Primary button** | `--action`, white text (dark text in dark mode), 44 px tall on phones, one per screen. Label is a verb plus the amount where one exists: "Commit sale · Rs 420" |
| **Secondary button** | White surface, `--border-input`, leaf text |
| **Destructive** | Red text. Void and write-off always ask for a reason in a sheet, never `prompt()` **[Report 8.6]** |
| **Inputs** | 44 px tall on phones, 38 px on laptop, `--border-input` outline, visible label above, error text below in words |
| **Segmented control** | Payment mode and tabs. Selected segment has a surface fill and a bottom border so it works without colour |
| **Table** | 40 px dense rows on laptop, sticky header, right-aligned tabular amounts, hover row highlight, keyboard-focusable rows |
| **Chip** | Icon + words + colour (section 5). Never colour only |
| **Modal (laptop)** | Centred, max 520 px, header with title and close, footer with actions on the right |
| **Sheet (phone)** | Slides from the bottom, 16 px top radius, drag handle, safe-area padding, primary action pinned |
| **Toast** | Bottom centre on laptop, above the tab bar on phone. Names the thing and the action: "Bill INV-1046 committed" |
| **Command palette** | Ctrl/Cmd+K on laptop. On phones, the search icon in the top bar opens the same palette full-screen |
| **Empty state** | One sentence on what is empty and one action: "No near-expiry batches. Everything on the shelf has more than 90 days." |
| **Error state** | What happened and what to do: "Haji Rafiq would go over his Rs 50,000 limit. Take a part payment or switch to cash." No apologies, no "Oops" |
| **Loading** | Skeleton rows in the same shape as the real rows. Spinner only inside buttons |
| **Offline** | A slim bar under the top bar: "Offline. Bills will be saved on this device and sent when you reconnect." Only if offline sales are actually supported **[Confirm]** |

### 9.1 The bill panel (the signature component)

| Property | Value |
|---|---|
| Surface | `--receipt`, 1 px border, 4 px top radius |
| Edge | Torn (zigzag) bottom, done with a CSS mask, no image |
| Dividers | 1.5 px dashed in `--border` |
| Header | "Current bill" and the invoice number, right-aligned |
| Lines | Name and price, batch and unit price under, quantity stepper, line total. Controlled lines have a 3 px purple left edge |
| Total | Bricolage Grotesque, 32 px, right-aligned, tabular numerals |
| After commit | The panel prints down and out (450 ms), then the bill modal opens |
| Printing | The print view reuses the same layout at 80 mm width (10.3) |

The same panel appears as the bottom sheet on phones, so the cashier's mental model does not change between devices.

---

## 10. Pharmacy-specific rules

### 10.1 Danger is designed in

- **Expired batches** are disabled in the batch picker. They are not just coloured. Add a short reason on the chip ("Expired 12 days ago").
- **Controlled drugs** show a purple "Controlled" pill in search, a purple edge in the bill, and a lock icon on Commit until the patient and prescriber details are saved.
- **Credit limit** is checked as the customer is chosen, not at commit, so the cashier finds out early.
- **Discount cap** clamps as the person types.
- **Void and write-off** require a typed reason in a sheet, with the reason saved to the record.

### 10.2 Speed on the counter

- The default screen after login is Billing **[Report 4.1]**.
- Focus returns to the search field after every add and after every commit.
- Quantity defaults to one pack, editable. Pressing Enter in the quantity field returns to search.
- Last-used payment mode is remembered for the session.

### 10.3 Printing

Server-rendered print views are opened with `window.open` **[Report 4.7]**, and the report flags a likely authentication failure there **[Report 8.1]**. Whichever fix you pick, the print view should share the Pine & Paper type and tokens:

```css
@media print{
  @page{size:80mm auto;margin:4mm}
  body{background:#fff;color:#000;font:12px/1.35 system-ui}
  .noprint{display:none}
}
```

Confirm the printer width (58 mm or 80 mm) **[Confirm]**.

### 10.4 Urdu and right-to-left **[Confirm]**

If customers, doctors or staff use Urdu names or receipts:

- Use `dir="auto"` on name fields so mixed text lays out correctly.
- Load **Noto Naskh Arabic** for Urdu. It is more compact than Nastaliq and fits 14 px table rows. Nastaliq needs taller rows.
- Build with CSS logical properties (`margin-inline-start`, `padding-inline-end`) so a future RTL switch does not mean a rewrite.

### 10.5 Hardware

- USB barcode scanners type quickly then press Enter. Keep the search field focused and handle Enter as "add".
- Touch laptops and tablets exist in shops. The 44 px touch targets on phones should also apply when `pointer: coarse` matches, even on a wide screen:

```css
@media (pointer:coarse){button,.chip,select,input{min-height:44px}}
```

---

## 11. Accessibility and performance

### 11.1 Accessibility checklist

- [ ] All text meets 4.5:1, all control outlines 3:1 (section 4.3)
- [ ] Visible focus ring on every interactive element: 2 px `--action` outline with 2 px offset
- [ ] Every status has an icon and words, not colour alone
- [ ] All actions work by keyboard. The F-key shortcuts are additions, never the only route
- [ ] Modals trap focus, close on Esc, and return focus to the button that opened them
- [ ] Sheets announce themselves with `role="dialog"` and `aria-modal`
- [ ] Toasts use `role="status"` so screen readers hear "Bill committed"
- [ ] Touch targets at least 44×44 on phones (WCAG 2.2 AA only asks for 24×24, but 44 is the practical thumb size)
- [ ] `prefers-reduced-motion` and `prefers-color-scheme` respected
- [ ] Page works at 200 percent zoom without horizontal scrolling

### 11.2 Performance on shop hardware

The report notes every page ships in one bundle **[Report 8.9]**. Layout choices that help:

- Lazy-load each screen with `React.lazy` once routes exist. Billing loads first, everything else on demand.
- Render only the first 20–30 search results, then "show more".
- Keep animation to `transform` and `opacity`.
- Avoid shadows on large lists. Borders are cheaper to paint.
- Limit web fonts to four files with a system fallback.
- Debounce search at 180 ms as you do today **[Report 5]**.

---

## 12. Rollout and testing

### 12.1 Rollout order

Ordered so that each step ships value and the theme can land without touching every page.

| Step | Work | Touches | Addresses |
|---|---|---|---|
| 1 | Add the token file (Appendix A) and map your existing variables onto it | One CSS file | Whole theme |
| 2 | Pin totals and Commit inside the bill panel on laptop | BillingPage | 768 px height |
| 3 | Replace the status pills with the icon + words chips | Shared `Chip` component | Section 5 |
| 4 | Introduce routes with `react-router-dom` | `App.tsx` | Back button, deep links **[Report 4.1]** |
| 5 | Add the bottom tab bar, floating bill bar and bottom sheet | App shell, Billing | Phone layout |
| 6 | Convert `Modal` to switch between centred and full-screen sheet by breakpoint | `Modal.tsx` | All dialogs **[Report 8.6]** |
| 7 | Replace `prompt()`, `confirm()`, `alert()` with sheets and toasts | SalesHistory, Stock | **[Report 8.6]** |
| 8 | Rebuild Dashboard around "Needs attention" | DashboardPage | Section 8.2 |
| 9 | Table-to-card conversion on Stock, Customers, Sales history | Those pages | Section 8.3 |
| 10 | Dark mode, camera scan, offline bar | Various | Sections 4.2, 8.1, 9 |

### 12.2 Token mapping from your current CSS

Your stylesheet was not visible **[Report 11]**, so only the variable *names* are known **[Report 4.6]**. Verify the right-hand column against your real file.

| Current | New | Note |
|---|---|---|
| `--mut` | `--ink-muted` | Set to `#5B6B62` (5.19:1 on paper) |
| `--bd` | `--border` | Decorative only |
| `--ok`, `--okb` | `--ok`, `--ok-bg` | Same meaning |
| `--er`, `--erb` | `--err`, `--err-bg` | Same meaning |
| `--br` | **[Confirm]** | Meaning not visible in the index |
| Classes `card`, `btn`, `pill`, `seg`, `kp`, `k`, `chips`, `gt`, `gw`, `ft` | Keep the names | Restyle them. No page edits needed for step 1 |

### 12.3 Testing

Test on real devices where you can.

| Check | Setup | Pass if |
|---|---|---|
| Hardest laptop | 1366×768 browser window | Commit visible with 8 items in the bill, no page scroll |
| Small phone | 360×640 | No horizontal scroll on Billing, Stock, Customers |
| Large phone | 430×932 | Sheet and tab bar respect notches and home bar |
| Tablet | 1024×768 and 768×1024 | Correct pane count in each orientation |
| Cashier task | A cashier sells 5 items, one controlled, on credit | Done in under a minute with no help |
| Colour-blind | Chrome DevTools vision emulation: deuteranopia | Every status still readable |
| Keyboard only | Unplug the mouse | Full sale completed |
| Low light | Dark theme in a dim room | Totals readable at arm's length |
| Slow hardware | 4x CPU throttle in DevTools | Search results appear within about half a second |

**Measure, do not guess:** time to complete one sale, number of mis-taps in the bill sheet, and how often the cashier needs the mouse on laptop.

---

## Appendix A: tokens as CSS

```css
:root{
  /* brand */
  --pine:#0C3A2B; --leaf:#1B6B4F; --leaf-hover:#14573F;
  --action:#C2410C; --action-hover:#A8380A; --on-action:#FFFFFF;
  /* surfaces */
  --paper:#F4F6F2; --surface:#FFFFFF; --receipt:#FFFDF6;
  --ink:#17231D; --ink-muted:#5B6B62;
  --border:#DFE5DF; --border-input:#7A8B81;
  /* status */
  --ok:#1B7A4B;   --ok-bg:#E1F3E8;
  --warn:#8A5200; --warn-bg:#FDF0D5;
  --err:#B3261E;  --err-bg:#FBE5E1;
  --rx:#5B2FA8;   --rx-bg:#EDE4FB;
  /* shape and space */
  --r-ctl:6px; --r-card:10px; --r-sheet:16px;
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px; --s8:32px;
  /* type */
  --font-head:"Bricolage Grotesque",system-ui,sans-serif;
  --font-body:Figtree,system-ui,"Segoe UI",Roboto,sans-serif;
  --fs-body:15px; --fs-dense:14px; --fs-input:15px;
  --ctl-h:38px;
}
@media (max-width:767px){:root{--fs-body:16px;--fs-dense:15px;--fs-input:16px;--ctl-h:44px}}
@media (pointer:coarse){:root{--ctl-h:44px}}

@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0E1612; --surface:#16211B; --receipt:#1C261F;
  --ink:#E8EFE9; --ink-muted:#93A39A;
  --border:#263329; --border-input:#6B8074;
  --leaf:#4FB68A; --action:#FF8A4C; --on-action:#1A0E05;
  --ok:#6FD6A0;   --ok-bg:#173625;
  --warn:#F2B84B; --warn-bg:#3A2C0F;
  --err:#FF8F82;  --err-bg:#3A1B17;
  --rx:#C6A8FF;   --rx-bg:#2E2147;
}}
:root[data-theme="dark"]{ /* same values as above, for the manual toggle */ }

body{font:var(--fs-body)/1.45 var(--font-body);background:var(--paper);color:var(--ink)}
h1,h2,h3{font-family:var(--font-head);letter-spacing:-.01em}
.money{font-variant-numeric:tabular-nums}
:focus-visible{outline:2px solid var(--action);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

Repeat the dark values under `:root[data-theme="dark"]` so the manual toggle works, then use `data-theme="light"` to override a dark system setting.

---

## Appendix B: problems in the first demo

I checked `hs-pharma-demo.html` against this research and found these. They are fixed in the specification above, not in the demo file.

| Problem | Evidence | Fix in this spec |
|---|---|---|
| Orange Commit button with white text fails AA | 3.06:1, needs 4.5:1 | `--action` `#C2410C`, 5.18:1 |
| Amber warning text fails AA | `#A86200` on tint is 4.22:1 | `#8A5200`, 5.66:1 |
| Input outlines fail the 3:1 control rule | `#DFE5DF` on white is 1.28:1 | `--border-input` `#7A8B81`, 3.60:1 |
| Commit button can scroll off a short laptop screen | Button sits below the scrolling bill | Pin totals and Commit (8.1) |
| Phones get an icon rail, not a tab bar | Rail only collapses, never moves | Bottom tab bar, floating bill bar, sheet (8.1) |
| Dialogs are centred modals on every screen | One `.md` style | Full-screen sheets on phones (9) |
| Tables only shrink | No row-to-card conversion | Conversion rule (8.3) |
| Status uses colour plus words but no icons | Pills carry text only | Icon + words chips (5) |

---

## 13. Limits of this research

- **I did not see your real CSS.** The Graphify index does not contain stylesheets **[Report 11]**. Colours, spacing and breakpoints here are a proposal, not a description of your current app. Paste `index.css` and I can map this precisely.
- **No user testing.** Recommendations come from established guidelines (WCAG 2.2, common touch-target sizes) and reasoning from your report. The test plan in 12.3 is how to find out what is wrong.
- **Device assumptions are unconfirmed.** I assumed shop laptops around 1366×768, thermal printing, and some phone use by the owner. Please confirm the items marked **[Confirm]**.
- **Role access is partly guessed.** Which screens the cashier can open comes from your report's role notes, not a full read of `NAV_ITEMS` **[Report 4.2]**.
- **Font features are unchecked.** Tabular numerals for Figtree and Bricolage Grotesque need to be tested in the browser.
- **Thresholds are suggestions.** The expiry day limits (30 and 90) and the 80 percent credit warning should be settings the owner can change.
- **The first demo is a sketch.** It covers five screens and has the issues in Appendix B. It is not the target design.
