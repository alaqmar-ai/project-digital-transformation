---
version: 1
name: Project Digital Transformation
description: >-
  Light, enterprise project-monitoring UI. Calm neutral surfaces, a single blue
  action color, soft pastel status accents, and generous rounding. Built with
  Next.js App Router + Tailwind; Inter for text, JetBrains Mono for figures.
colors:
  background: "#F5F7FA"
  panel: "#FFFFFF"
  card: "#FFFFFF"
  elevated: "#F9FAFB"
  surfaceHover: "#F3F4F6"
  primary: "#2563EB"
  primaryHover: "#1D4ED8"
  primaryLight: "#DBEAFE"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  info: "#06B6D4"
  textPrimary: "#0F172A"
  textSecondary: "#475569"
  textMuted: "#64748B"
  border: "#E5E7EB"
  borderStrong: "#D1D5DB"
typography:
  fontFamily:
    sans: "Inter, system-ui, sans-serif"
    mono: "JetBrains Mono, ui-monospace, monospace"
  fontSize:
    pill: "11.5px"
    tableHeader: "12px"
    toast: "13px"
    control: "13.5px"
    sectionHeader: "14px"
  fontWeight:
    regular: 400
    medium: 500
    semibold: 600
    bold: 700
    heavy: 800
rounded:
  control: "10px"
  card: "16px"
  cardLarge: "20px"
  pill: "999px"
spacing:
  pageX: "20px"
  pageXWide: "32px"
  cardPad: "20px 24px"
  controlPadY: "9px"
  controlPadX: "12px"
  maxContentWidth: "1600px"
components:
  card:
    backgroundColor: "#FFFFFF"
    border: "1px solid #E5E7EB"
    rounded: "16px"
    shadow: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)"
  buttonPrimary:
    backgroundColor: "#2563EB"
    textColor: "#FFFFFF"
    rounded: "10px"
    padding: "9px 16px"
    typography: { fontSize: "13.5px", fontWeight: 600 }
  buttonGhost:
    backgroundColor: "#FFFFFF"
    textColor: "#0F172A"
    border: "1px solid #E5E7EB"
    rounded: "10px"
    padding: "9px 16px"
  input:
    backgroundColor: "#FFFFFF"
    border: "1px solid #E5E7EB"
    rounded: "10px"
    padding: "9px 12px"
    focusRing: "0 0 0 4px rgba(37,99,235,0.12)"
  pill:
    rounded: "999px"
    padding: "2px 10px"
    typography: { fontSize: "11.5px", fontWeight: 600 }
  toast:
    backgroundColor: "rgba(15,23,42,0.95)"
    textColor: "#F8FAFC"
    rounded: "10px"
    shadow: "0 8px 32px rgba(0,0,0,0.3)"
---

# Project Digital Transformation — Design System

## Overview

A light, enterprise dashboard for tracking equipment projects, stage schedules,
attendance, and analytics. The aesthetic is calm and information-dense: neutral
grey-blue surfaces, white cards, one decisive blue for actions, and soft pastel
fills reserved for status. The app is **light-mode only** (`color-scheme: light`).
Tokens live in `tailwind.config.ts` and `src/app/globals.css`; this file is the
source of truth for their meaning.

## Colors

- **Surfaces** — Page background is `#F5F7FA`. Cards and panels are pure white
  `#FFFFFF`; `#F9FAFB` is the elevated/zebra tone and `#F3F4F6` is the hover wash.
- **Primary** — `#2563EB` for all primary actions, links, focus, and active
  state. Hover darkens to `#1D4ED8`; `#DBEAFE` is the tint for selected/soft fills.
- **Semantic** — success `#10B981`, warning `#F59E0B`, danger `#EF4444`,
  info `#06B6D4`. Used for status, deltas, and the toast accent bar.
- **Text** — primary `#0F172A`, secondary `#475569`, muted `#64748B`. Never put
  primary text on a dark surface (see Do's and Don'ts).
- **Borders** — default `#E5E7EB`, strong `#D1D5DB` on hover/emphasis.
- **Status pastels** — soft fills for calendar cells and pills: present `#D1FAE5`,
  annual `#DBEAFE`, medical `#FEE2E2`, training `#EDE9FE`, weekend-job `#FEF3C7`,
  holiday-job `#FEF9C3`, delayed `#FECACA`.

## Typography

- **Families** — Inter (`--font-inter`) for all UI text; JetBrains Mono
  (`--font-mono`) for numbers, IDs, and code. Loaded via `next/font`.
- **Scale** — controls and table cells `13.5px`, table headers `12px` uppercase
  with `0.04em` tracking, section/chart headers `14px`, pills `11.5px`,
  toasts `13px`.
- **Weight** — body `400`, emphasis `500`, headings/buttons/pills `600`;
  `700`–`800` reserved for hero figures. Headings use slight negative tracking
  (`-0.01em`).

## Layout

- **Width** — content caps at `1600px` (`max-w-content`), centered.
- **Page padding** — `20px` (`p-5`), widening to `32px` (`md:p-8`).
- **Cards** — `20px 24px` internal padding; chart-card header is `20px 24px 8px`.
- **Rhythm** — 4px-based gaps (`gap-2`/`gap-2.5`); tables pad cells `12px 16px`.

## Elevation & Depth

Depth is communicated with hairline borders first, soft shadows second — never
heavy drop shadows.

- **card** — `0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)`
- **card-hover** — `0 4px 6px -1px rgba(15,23,42,0.06), 0 2px 4px -2px rgba(15,23,42,0.04)`
- **elevated** — `0 10px 15px -3px rgba(15,23,42,0.06), 0 4px 6px -4px rgba(15,23,42,0.04)`
- **focus-ring** — `0 0 0 4px rgba(37,99,235,0.12)` paired with a `#2563EB` border.

## Shapes

- **Controls** (buttons, inputs, selects) — `10px` radius.
- **Cards** — `16px` (`rounded-xl`); large containers `20px` (`rounded-2xl`).
- **Pills / status** — fully rounded `999px`.
- **Scrollbars** — 8px, thumb `#E5E7EB` → `#D1D5DB` on hover.

## Components

- **Card** (`.card`) — white, `1px #E5E7EB` border, `16px` radius, card shadow;
  hover lifts border to `#D1D5DB` + card-hover shadow.
- **Button / primary** (`.btn-primary`) — `#2563EB` on white text, `10px`,
  `600`. Disabled fades to `#93C5FD`.
- **Button / ghost** (`.btn-ghost`) — white, `#0F172A` text, grey border;
  hover wash `#F9FAFB`.
- **Input / Select** (`.input-styled`, `.select-styled`) — white, grey border,
  `10px`; focus = `#2563EB` border + focus-ring.
- **Pill** (`.pill`) — fully rounded, `11.5px`/`600`, colored by status token.
- **Data table** (`.data-table`) — `16px` clipped container, `#F9FAFB` header,
  `12px` uppercase headers, `13.5px` rows, `#F9FAFB` row hover.
- **Toast** (`src/components/Toast.tsx`) — dark glass `rgba(15,23,42,0.95)` with
  `12px` blur, **light text `#F8FAFC`**, success/danger accent bar, bottom-right.

## Do's and Don'ts

- **Do** drive every color from a token; don't hardcode new hex values in
  components.
- **Do** keep one action color (blue). Don't introduce a second primary.
- **Do** use the dark toast surface — but **never** put dark `text-primary`
  (`#0F172A`) on it; toast text must be light (`#F8FAFC`). This was a real bug.
- **Do** reserve pastel status fills for status only; don't use them as
  decoration.
- **Do** lead with borders for separation; don't reach for heavy shadows.
- **Don't** add a dark theme — the app is light-only (`color-scheme: light`),
  including native controls like `<input type="date">`.
