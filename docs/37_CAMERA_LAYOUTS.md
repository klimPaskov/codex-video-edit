# Camera and layout specification

## Source policy

Camera is optional. When enabled during recording, keep it as a separate synchronized source. Imported camera media may be linked manually.

## Built-in layouts

- Screen only
- Camera only
- Camera bubble over screen
- Side by side
- Presenter with screen inset
- Screen with camera strip
- Custom position within bounded controls

The first release does not expose arbitrary node compositing.

## Per-layout controls

- camera shape: rectangle, rounded rectangle, circle
- position and size
- crop and fit
- border and shadow
- entrance and exit fade
- background colour or local image
- scene or range scope

## Automatic behavior

Magic Wand may choose a layout only when both sources exist and the preset enables camera layout. It should favor screen visibility during demonstrations and larger camera presence during introductions or direct explanation. Every switch creates a visible layout marker.

## Manual behavior

Select the camera on canvas or its timeline clip to open the layout inspector. Drag and resize directly, with safe-area guides and numeric controls.

## Synchronization

Camera and screen share the recording session clock. The preview and final renderer use the same source-to-output map. Frame drops or offset beyond policy become a QA finding.

## Reframing

Layouts must adapt to 16:9, 9:16, 1:1, 4:5, and custom canvas. Do not simply crop the speaker or important screen content. Save per-canvas overrides when needed.
