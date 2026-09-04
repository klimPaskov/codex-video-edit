# Accessibility

## Requirements

- All actions are reachable by keyboard.
- Use semantic controls and accessible names.
- Keep visible focus indicators.
- Do not communicate state by colour alone.
- Support 100 to 200 percent UI scaling.
- Keep readable contrast in light and dark themes if both ship.
- Provide text alternatives for icon-only controls through tooltips and labels.
- Make timeline operations available through keyboard and numeric inspector fields.
- Announce background progress and completed AI operations without flooding screen readers.
- Respect reduced-motion settings in app chrome while preserving video preview accuracy.

## Captions

Caption defaults should remain readable, safe from canvas edges, and editable. The app should warn when a user style becomes too small or low contrast.

## Testing

Include keyboard-only, screen-reader smoke, zoomed UI, high-contrast, focus order, and reduced-motion tests. Computer-use review must verify visible focus and clipped text at common window sizes.
