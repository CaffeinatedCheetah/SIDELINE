# Motion and animation

## Tokens

- Instant: 0 ms for state requiring no transition.
- Fast: 120 ms for hover/press/color.
- Standard: 200 ms for menus, tabs, and small layout changes.
- Emphasis: 300 ms for modal/sheet entry.
- Easing: `cubic-bezier(.2,.8,.2,1)` enter; `cubic-bezier(.4,0,1,1)` exit.

## Required behavior

- Hover/press transforms are at most 1 px translation or 0.99 scale.
- Modals fade scrim and translate/scale content slightly; focus moves only after
  content is mounted.
- Score changes may briefly highlight changed digits, never flash more than
  three times or rely on animation alone.
- Skeletons use a low-contrast pulse, not a sweeping bright shimmer.
- Toasts do not disappear while hovered or focused.

## Reduced motion

Under `prefers-reduced-motion: reduce`, remove nonessential transforms, smooth
scrolling, score highlights, and skeleton pulse; use immediate opacity/state
changes. Functional progress indicators may continue without rotation when a
text status is present.

No autoplay animation, confetti, parallax, or infinite decorative motion is in
Version 1.
