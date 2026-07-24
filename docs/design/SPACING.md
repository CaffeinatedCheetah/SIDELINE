# Spacing and geometry

## Spacing scale

Base unit is 4 px. Tokens: `0`, `1`=4, `2`=8, `3`=12, `4`=16, `5`=20,
`6`=24, `8`=32, `10`=40, `12`=48, `16`=64, `20`=80, `24`=96 px.

Use 8–12 px inside compact metadata, 16 px card padding on mobile, 20–24 px card
padding on larger screens, 24–32 px between related sections, and 48–80 px
between major public-page bands.

## Layout

- Page max width: 1280 px.
- Desktop gutters: 32 px; tablet: 24 px; mobile: 16 px.
- Conversation rail: 720 px maximum.
- Sidebar: 320 px; inter-column gap: 24 px.
- Global header: 64 px desktop, 56 px mobile.
- Mobile bottom navigation: 64 px plus safe-area inset.

## Geometry

- Radius `sm` 6 px, `md` 10 px, `lg` 16 px, `pill` 999 px.
- Default cards use `md`; hero panels and modals use `lg`; fields/buttons use
  `sm` or `md` based on size.
- Border is 1 px; focus outline is 2 px with 2 px offset.
- Shadows remain subtle on dark surfaces: `0 12px 32px rgba(0,0,0,.36)` for
  overlays only. Cards rely on borders, not floating white-page shadows.

## Touch and density

Touch targets are at least 44×44 px. Dense score metadata may visually occupy
less space only when its interactive parent meets target size. Do not use
negative margins to overlap interactive targets.
