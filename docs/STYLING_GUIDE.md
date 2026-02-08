# Calypso Design Language

Dieser Guide beschreibt die Design-Sprache und visuelle Philosophie basierend auf den X-LNG Applikationen (Netback Calculator, Position List Dashboard).

---

## 0. Design-Referenzen & Einordnung

### Stil-Einordnung

Die Calypso Design Language kombiniert mehrere moderne UI-Ansätze:

**Glassmorphism** - Transparente Hintergründe mit Blur-Effekten, schwebende Cards
**Soft UI** - Abgerundete Ecken, subtile Schatten, sanfte Übergänge
**Data-Dense Dashboard** - Hohe Informationsdichte ohne Chaos
**Trading Terminal (modernisiert)** - Heatmaps, Real-time Updates, Spread-Darstellung

### Vergleichbare Referenzen

| Referenz | Was wir übernehmen |
|----------|-------------------|
| **Linear** | Card-Shadows, Hover-Lifts, Clean Typography |
| **Stripe Dashboard** | Heatmap-Tabellen, KPI-Banners, Data Density |
| **Notion** | Collapsible Sections, Progressive Disclosure |
| **Raycast** | Dark Panels, Keyboard-First, Schnelle Interaktion |
| **Bloomberg Terminal** | Farbsemantik (Grün/Rot), Spread-Display (modernisiert) |

### Nicht-Ziele

- ❌ Skeuomorphism (keine Texturen, keine "realen" Objekte)
- ❌ Flat Design (wir nutzen Schatten und Tiefe)
- ❌ Material Design (keine Ripple-Effects, keine FABs)
- ❌ Brutalism (keine harten Kontraste, keine absichtliche "Hässlichkeit")

---

## 1. Design-Philosophie

### 1.1 Kernprinzipien

**Information Density mit Klarheit**
- Viele Daten auf einem Screen, aber klar strukturiert
- Jede Information hat ihren visuellen "Platz"
- Whitespace trennt logische Gruppen

**Color = Meaning**
- Farben sind nie nur dekorativ
- Jede Farbe transportiert semantische Information
- Konsistente Farbsprache durch die gesamte App

**Progressive Disclosure**
- Nicht alles auf einmal zeigen
- Collapsible Sections für Detailtiefe
- Hover/Click für zusätzliche Informationen
- Wichtiges prominent, Details auf Nachfrage

**Numbers as First-Class Citizens**
- Zahlen sind das Wichtigste in Trading-Apps
- Immer `tabular-nums` für Ausrichtung
- Große, fette Zahlen für KPIs
- Farbcodierung für Positiv/Negativ

### 1.2 Visual Hierarchy

```
1. KPI Banners      → Größte Zahlen, prominente Position, Gradient-Hintergrund
2. Section Headers  → Uppercase, letter-spacing, klein aber autoritär
3. Data Tables      → Sticky Headers, Heatmap-Farben, interaktive Zellen
4. Content Cards    → Abgegrenzte Container mit Schatten
5. Detail Text      → Klein, muted, sekundär
```

---

## 2. Farbsemantik

### 2.1 Brand & Primary: Teal

Teal ist die Signature-Farbe. Sie signalisiert:
- **Primäre Aktionen** (Buttons)
- **Beste Option / Optimum** (in Heatmaps)
- **Aktiver/Selektierter Zustand** (Tabs, Cells)
- **Brand Identity** (Header-Gradient)

Header-Gradient: Dunkles Teal → Helles Teal (von links nach rechts)

### 2.2 Semantische Farben

| Bedeutung | Farbe | Verwendung |
|-----------|-------|------------|
| **Positiv / Profit / Good** | Grün (Emerald) | Positive Spreads, erfolgreiche Werte |
| **Negativ / Loss / Bad** | Rot (Rose) | Negative Spreads, Fehler, Warnungen |
| **Neutral / Pending** | Grau (Slate) | Inaktive States, neutrale Info |
| **Warning / Attention** | Orange (Amber) | Deadlines, benötigt Aktion |
| **Info / Reference** | Blau | Links, Info-Badges |

### 2.3 Trade-Richtung (Position List)

| Seite | Farbe | Bedeutung |
|-------|-------|-----------|
| **Long / Buy** | Blau | Wir kaufen, Counterparty verkauft |
| **Short / Sell** | Lila/Purple | Wir verkaufen, Counterparty kauft |

Diese Farben erscheinen bei:
- Counterparty-Namen
- Richtungspfeile (↑ blau = Loading/Source, ↓ lila = Discharge/Destination)
- Zellen-Hintergründe in Trade-Cards

### 2.4 Month/Category Colors

Monate haben eigene Farben für schnelle visuelle Unterscheidung:
- JAN/FEB: Blau/Cyan
- MAR: Grün
- MAY: Orange
- JUN/JUL: Rot/Pink
- AUG: Pink
- SEP: Indigo
- OCT: Cyan
- NOV: Teal

### 2.5 Heatmap-Logik

In der Scenario-Tabelle (Netback Calculator):

```
Beste Werte (Top 10%)      → Kräftiges Grün (dunkel)
Gute Werte (10-25%)        → Mittleres Grün  
Überdurchschnitt (25-50%)  → Helles Grün
Unterdurchschnitt (50-75%) → Neutral/Weiß
Schlechte Werte (75-90%)   → Helles Amber
Worst (90-100%)            → Rose
Invalid/Error              → Rot-Hintergrund, Text ausgegraut
```

**Wichtig:** Die beste Zelle bekommt zusätzlich einen Teal-Ring als "Selected/Best" Indikator.

---

## 3. Typography-Prinzipien

### 3.1 Font

**Inter** als Hauptfont - klar, modern, excellent für Zahlen.

### 3.2 Hierarchie durch Größe & Gewicht

| Element | Stil | Beispiel |
|---------|------|----------|
| KPI Headline | Sehr groß, bold, tabular | "$10.99" im Scenario Panel |
| Section Header | Klein, uppercase, tracking, semibold | "COST BREAKDOWN" |
| Entity Name | Groß, bold | "TotalEnergies", Port-Namen |
| Body Text | Normal | Beschreibungen |
| Detail/Muted | Klein, grau | Datums-Details, Sub-Info |
| Badge Text | Sehr klein, semibold | "DES", "TTF", "Best" |

### 3.3 Zahlen-Styling

**Immer `tabular-nums`** - damit Zahlen in Spalten ausgerichtet sind.

**Spread-Darstellung:**
- Positiv: `+0.05` in Grün
- Negativ: `-0.04` in Rot
- Unbekannt: `TBD` in Orange

**Währung:**
- Große Beträge: `$1.67M` oder `$37.98M`
- Per-Unit: `$0.485/MMBtu`
- Immer rechtsbündig in Tabellen

---

## 4. Layout-Patterns

### 4.1 Three-Panel Layout (Netback Calculator)

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (Gradient Teal, weiße Schrift)                      │
│  Titel + Key Info (Load Date, Expected Discharge)           │
├─────────────────────────────────────────────────────────────┤
│  TAB BAR (Weiß, aktiver Tab mit Teal-Underline)             │
├────────────┬──────────────────────────────┬─────────────────┤
│            │                              │                 │
│  SIDEBAR   │     MAIN CONTENT             │  DETAIL PANEL   │
│  (Params)  │     (Heatmap Table)          │  (Dark, Teal    │
│            │                              │   Gradient)     │
│  - Inputs  │     - Day Selector           │                 │
│  - Sliders │     - Expandable Tables      │  - KPI Banner   │
│  - Labels  │     - Heatmap Cells          │  - Cost List    │
│            │                              │  - Timeline     │
│            │                              │                 │
└────────────┴──────────────────────────────┴─────────────────┘
```

**Charakteristiken:**
- Sidebar: Parameter-Eingaben, vertikal gestapelte Cards
- Main: Scrollbarer Content, die eigentlichen Daten
- Detail Panel: Dunkler Hintergrund, zeigt Details zu Selektion

### 4.2 Dashboard Table Layout (Position List)

```
┌──────────────────────────────────────────────────────────────┐
│ ● SECTION HEADER    [count] trades                      [^] │
├──────────────────────────────────────────────────────────────┤
│ MONTH │ LONG (Buy Side)    │ [Vessel] │ SHORT (Sell Side)  │ │
├───────┼────────────────────┼──────────┼────────────────────┼─┤
│ MAR   │ TotalEnergies      │          │ Mitsui             │ │
│  14   │ JKM +0.02          │ LNG      │ JKM +0.07          │ │
│ 2025  │ ↑ Source           │ Jubail   │ ↑ Source           │ │
│       │ ↓ Destination      │          │ ↓ Destination      │ │
│       │ Volume             │          │ Volume             │ │
├───────┼────────────────────┼──────────┼────────────────────┼─┤
```

**Charakteristiken:**
- Month als visuelle Trennung (farbiger Badge + große Tageszahl)
- Long/Short symmetrisch gespiegelt
- Vessel in der Mitte als "Verbindungsstück"
- Spread/Risk als Zusammenfassung rechts

---

## 5. Component-Patterns

### 5.0 Grundlegende UI-Elemente

#### Buttons

| Variant | Aussehen | Verwendung |
|---------|----------|------------|
| **Primary** | Teal-Hintergrund, weiße Schrift, Schatten | Hauptaktionen, CTAs |
| **Secondary** | Weißer Hintergrund, grauer Border, dunkle Schrift | Sekundäre Aktionen |
| **Ghost** | Transparent, nur Text, Hover zeigt Hintergrund | Toolbar-Icons, Cancel |
| **Danger** | Rose-Hintergrund (light), Rose-Text | Löschen, Destructive Actions |

Alle Buttons:
- Abgerundete Ecken (rounded-lg)
- Hover: Leicht dunklere Farbe
- Active: Scale-Down (95%), Shadow-Change
- Disabled: Opacity 50%, kein Cursor

#### Badges/Pills

| Tone | Aussehen | Verwendung |
|------|----------|------------|
| **Neutral** | Grauer Hintergrund | Default, Info |
| **Success** | Grüner Hintergrund | Done, Profit, Valid |
| **Warning** | Amber Hintergrund | Pending, Attention |
| **Error** | Rose Hintergrund | Invalid, Loss, Urgent |
| **Primary** | Teal Hintergrund | Highlighted, Best |

Badges sind:
- Pill-shaped (rounded-full)
- Kleine Schrift, semibold
- Uppercase für Status-Badges (optional)

#### Cards

| Variant | Aussehen | Verwendung |
|---------|----------|------------|
| **Default/Glassmorphism** | Leicht transparent, Blur, subtiler Schatten | Floating Cards |
| **Solid** | Komplett weiß, klarer Border | Standard Content |
| **Dark** | Dunkler Gradient, helle Schrift | Detail Panels, Kontrast |

Card-Eigenschaften:
- Rounded corners (xl oder 2xl)
- Shadow für Tiefe
- Hover: Schatten verstärkt, leichter Lift
- Header-Section mit Border unten (optional)

#### Inputs

- Border: Slate, verstärkt bei Focus
- Focus: Ring in Teal
- Label oberhalb, klein, medium weight
- Mit Unit-Suffix wenn nötig (z.B. "/day", "kts")
- Range Slider: Teal-Thumb, Slate-Track

### 5.1 Section Header (Collapsible)

```
● SECTION TITLE    [count] items                         [▲/▼]
──────────────────────────────────────────────────────────────
```

- Grüner Punkt = Aktiv/Matched
- Titel in Uppercase, tracking
- Count als Badge
- Chevron für Expand/Collapse
- Gesamte Row ist klickbar

### 5.2 Card mit Header

```
┌─────────────────────────────────────────┐
│ [Icon] SECTION TITLE                    │  ← Header: Heller BG, Border unten
├─────────────────────────────────────────┤
│                                         │
│  Content                                │  ← Body: Weißer BG, Padding
│                                         │
└─────────────────────────────────────────┘
```

- Icon links vom Titel (farbig nach Kategorie)
- Titel: Uppercase, small, semibold, tracking
- Rounded corners, subtle shadow
- Hover: Leichter Schatten-Lift

### 5.3 KPI Banner (Gradient)

```
┌─────────────────────────────────────────┐
│  BREAK-EVEN DES        TTF DISCOUNT     │  ← Labels klein, hell
│  $10.99                -1.01            │  ← Werte groß, weiß, bold
│  per MMBtu             TTF: $12.00      │  ← Sub-Info klein
└─────────────────────────────────────────┘
```

- Gradient-Hintergrund (Teal)
- Weiße Schrift
- Große Zahlen dominant
- Kleine Labels oben

### 5.4 Cost Breakdown List

```
  [●] Charter                              $1.67M
      19.7d @ $85k/d                       $0.485/MMBtu
  ────────────────────────────────────────────────
  [●] Fuel                                 $688k
      50 MMBtu/d • 17.2d                   $0.199/MMBtu
```

- Farbiger Icon-Circle links (Farbe nach Kategorie: Blau=Charter, Orange=Fuel, etc.)
- Name + Hauptwert auf einer Zeile
- Detail + Per-Unit-Cost darunter, muted
- Trennlinie zwischen Items
- Total am Ende dicker getrennt

### 5.5 Trade Cell (in Table)

```
┌─────────────────────────────┐
│ JKM +0.02                   │  ← Price/Index prominent
│ ↑ Petronas FLNG2 • Malay... │  ← Source mit Pfeil, truncated
│ ↓ Ningbo • China (We)       │  ← Destination mit Pfeil
│─────────────────────────────│
│ 3.4M ±5%                    │  ← Volume am Ende
└─────────────────────────────┘
```

- Light Background (blau für Long, lila für Short)
- Border in entsprechender Farbe
- Pfeile zeigen Richtung: ↑ = Herkunft, ↓ = Ziel
- "(We)" oder "(CP)" zeigt wer nominiert
- Volume unten mit Border-Top

### 5.6 Vessel Badge

```
────○ [🚢 LNG Jubail] ○────
```

- Zwischen Long und Short
- Ship-Icon
- Name truncated wenn nötig
- Horizontale Linien verbinden mit beiden Seiten
- Gradient-Border (Blau → Lila)

### 5.7 Spread Display

```
+0.05    ← Grün, groß, bold für positiv
-0.04    ← Rot für negativ
TBD      ← Orange für unbekannt
OPEN     ← Rot-Hintergrund für offene Position
```

### 5.8 Day Selector (Heatmap)

```
┌──────────┬──────────┬──────────┬──────────┐
│  Day 0   │  Day 1   │  Day 2   │  Day 3   │
│  Aug 28  │  Aug 29  │  Aug 30  │  Aug 31  │
└──────────┴──────────┴──────────┴──────────┘
     ▲
  Aktiver Tag: Teal-Hintergrund, weiße Schrift
  Inaktive: Weißer Hintergrund, grauer Text
```

### 5.9 Nomination Status

```
✓ 4/4 Noms                    ← Alle done: Grün mit Checkmark
2/4 Done  Next: Oct 15 (-4d)  ← Partial: Count + nächste Deadline
```

- Deadline-Badge färbt sich nach Urgency:
  - ≤3 Tage: Rot
  - ≤7 Tage: Orange  
  - >7 Tage: Blau

### 5.10 Mini Distribution Chart

```
▁▂▄█▆▃▁
```

Klein, inline, zeigt Risiko-Verteilung visuell.

### 5.11 Timeline (Voyage)

Vertikale Darstellung von Schritten mit verbindender Linie:

```
  ●──┐  Loading
     │  Port Name, Date
     │  Duration, Details
     │
  ●──┤  Laden Voyage
     │  Route, Speed
     │  Boil-off Info
     │
  ●──┤  Arrival
     │  Port, ETA
     │
  ●──┘  Ballast Return
        Route, Duration
```

- Farbiger Kreis pro Step (Grün = Laden, Rot = Ballast, Grau = Loading/Discharge)
- Vertikale Linie verbindet Steps
- Content rechts vom Circle

### 5.12 Key-Value Rows

Für Parameter-Listen und Detail-Anzeigen:

```
Label                          Value
──────────────────────────────────────
FOB Price                    $10.00/MMBtu
Charter Rate                    $85k/day
Ballast Speed                     16 kts
```

- Label links, muted
- Value rechts, bold, tabular-nums
- Optionale Trennlinien zwischen Gruppen

### 5.13 Left-Border Sections

Gruppierte Informationen mit farbiger Linie links:

```
│ Category Name
│────────────────────────
│  Item 1              Value 1
│  Item 2              Value 2
│  Item 3              Value 3
```

- Farbige Border-Left (Teal für Voyage, Amber für Market, etc.)
- Visuell gruppiert ohne extra Card

---

## 6. States

### 6.1 Interactive States

| State | Visuelles Verhalten |
|-------|---------------------|
| **Default** | Normale Darstellung |
| **Hover** | Hellerer/Dunklerer Hintergrund, Cursor pointer |
| **Active/Pressed** | Scale down (95%), Shadow change |
| **Focus** | Ring in Primary-Farbe (Teal) |
| **Disabled** | 50% Opacity, cursor not-allowed |

### 6.2 Selection States

| State | Visuelles Verhalten |
|-------|---------------------|
| **Selected Row** | Light Blue Hintergrund |
| **Active Tab** | Teal Underline + Teal Text |
| **Best Option** | Teal Ring + "Best" Badge |
| **Pinned** | Teal Hintergrund, Icon aktiv |

### 6.3 Data States

| State | Visuelles Verhalten |
|-------|---------------------|
| **Valid** | Grüner Hintergrund (in Heatmap) |
| **Invalid** | Roter Hintergrund, ausgegrauter Text |
| **TBD/Unknown** | Orange Text/Badge |
| **Open Position** | Roter Hintergrund, "OPEN" Badge |

### 6.4 Loading State

```
┌─────────────────────────────────────────┐
│  [Spinner]  Calculating Scenarios...    │
│  ████████████░░░░░░░░░░░░  Progress     │
└─────────────────────────────────────────┘
```

- Teal Hintergrund (light)
- Animierter Progress-Bar
- Descriptive Text
- Spinner Icon

### 6.5 Empty State

- Zentrierter Text
- Muted Farbe
- Optional: Icon oberhalb
- CTA Button falls sinnvoll

---

## 7. Interaktions-Patterns

### 7.1 Hover Behaviors

**Table Rows:**
- Hintergrund wird leicht heller
- Cursor wird Pointer
- Zeigt an: "Klickbar für Details"

**Heatmap Cells:**
- Ring/Border erscheint
- Ganze Row und Column werden subtle gehighlighted
- Detail Panel zeigt Scenario-Info

**Cards:**
- Leichter Schatten-Lift
- Subtle Y-Translation nach oben

### 7.2 Expandable Sections

- Chevron Down = Collapsed
- Chevron Up = Expanded
- Smooth Animation beim Öffnen
- Content faded in

### 7.3 Tooltips/Popovers

Erscheinen bei Hover auf:
- Truncated Text (zeigt vollen Text)
- Port-Namen (zeigt alle Optionen)
- Preise (zeigt Index-Details)
- Volumes (zeigt Tolerance, Nominator)

Styling: Dark Background, kleine Schrift, gut lesbar.

---

## 8. Responsive Considerations

**Desktop-First Design** - Diese Apps sind primär für Desktop.

Für Mobile (Task Management App):
- Sidebar wird zu Bottom-Navigation oder Hamburger
- Three-Column wird zu Single-Column mit Tabs
- Tables werden zu Cards/Lists
- Hover-Tooltips werden zu Tap-to-reveal

**Keine fixen Pixel-Widths** - Verwende flex, relative Units.

---

## 9. Icon Usage

**Library:** Lucide React (oder Lucide Angular)

**Häufig verwendet:**
- `Ship` - Vessels, Charter, Voyage
- `Building` - Ports, Facilities
- `DollarSign` - Prices, Costs, Money
- `Package` - Cargo, Volume
- `Droplet` - Fuel
- `Cloud` - Boil-off, Losses
- `Clock` - Timing, Deadlines
- `Calendar` - Dates
- `ChevronDown/Up` - Expand/Collapse
- `X` - Close, Cancel
- `Pin` - Pin/Unpin
- `Search` - Filter/Search
- `AlertTriangle` - Warnings
- `Check` - Done, Success
- `BarChart3` - Analytics, Breakdown

### Icon-Kategorie-Farben

Icons in Listen bekommen farbige Kreise als Hintergrund, die Farbe zeigt die Kategorie:

| Kategorie | Hintergrund | Icon-Farbe |
|-----------|-------------|------------|
| Charter/Ship | Blau (light) | Blau |
| Fuel | Orange (light) | Orange |
| Boil-off/Loss | Rose (light) | Rose |
| Port/Building | Indigo (light) | Indigo |
| Cargo/Package | Teal (light) | Teal |
| Market/Money | Amber (light) | Amber |
| Voyage | Teal (light) | Teal |
| Constraints | Emerald (light) | Emerald |
| Total/Summary | Slate (light) | Slate |

**Sizing:** Konsistent innerhalb eines Kontexts (kleine Icons in Listen, größere in Headers).

---

## 10. Animation & Transitions

**Subtil und purposeful:**
- Hover-Transitions: ~200ms
- Expand/Collapse: ~300ms
- Loading Progress Bar: Animated
- Card Lift: Smooth transform

**Keine überflüssigen Animationen** - Trading-Apps müssen schnell sein.

---

## 11. Key Takeaways für Task App

1. **Sidebar + Main Content** - Klassisches App-Layout
2. **Teal als Primary** - Buttons, aktive States, Brand
3. **Cards mit Headers** - Für jeden Bereich
4. **Semantic Colors** - Status, Priority mit Farbe zeigen
5. **Collapsible Sections** - Für Boards, Filter, etc.
6. **Hover = More Info** - Progressive disclosure
7. **Numbers prominent** - Task counts, Dates groß
8. **Badges für Status** - Priority, Labels als Pills
9. **Dark Header/Panel** - Als Kontrast-Element möglich
10. **Inter Font + tabular-nums** - Für alle Zahlen

---

## Referenz: Tailwind Klassen (die wichtigsten)

```css
/* Primary */
bg-teal-600, hover:bg-teal-700, text-teal-600, ring-teal-500

/* Status */
bg-emerald-100 text-emerald-700  /* success */
bg-rose-100 text-rose-700        /* error */
bg-amber-100 text-amber-700      /* warning */

/* Neutral */
bg-slate-50/100, text-slate-500/600/700/900, border-slate-200/300

/* Typography */
font-semibold, font-bold, uppercase, tracking-wide, tabular-nums

/* Layout */
flex, flex-col, items-center, justify-between, gap-*
rounded-lg, rounded-xl, rounded-2xl
shadow-sm, shadow-lg, shadow-xl

/* Transitions */
transition-all duration-200
hover:-translate-y-0.5, active:scale-95
```
