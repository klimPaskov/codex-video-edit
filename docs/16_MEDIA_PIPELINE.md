# Media pipeline

## Time model

- Store media time as integer microseconds.
- Store frame rates as rational numerator and denominator.
- Convert to preview or render frames through one tested library.
- Never use floating-point seconds as the authoritative edit clock.

## Ingest

1. Hash and probe source.
2. Persist stream metadata.
3. Use source or lossless edit media by default. Create a lower-quality playback proxy only for an explicit Faster preview setting.
4. Create mono speech proxy.
5. Create thumbnails, waveform, and contact sheets.
6. Record every artifact hash and tool version.

## Render layers

- FFmpeg handles probing, trimming, retiming, audio, codecs, muxing, and decode QA.
- A declarative composition layer handles camera layouts, backgrounds, text, captions, B-roll, crops, zooms, and canvas transforms.
- Preview and export consume the same canonical timeline.

## Stages

Every stage key includes input hashes, configuration, implementation version, and model identity when relevant. Write to staging, validate, then promote atomically.

## Cache

Reuse artifacts only when their stage key and stored output hash match. Tampered or partial artifacts are not cache hits.

## Failure evidence

Keep concise structured diagnostics and the last failed staging artifact when it helps repair. Do not surface raw FFmpeg output in ordinary UI.

## Supported export baseline

- Default lossless master: Matroska, FFV1, and representation-matched PCM
- Native dimensions and timing unless an explicit canvas or retiming operation changes them
- Source or canonical colour metadata and sample precision preserved
- Optional SRT and WebVTT
- Optional user-selected compressed MP4 sharing copy
- No silent fallback to a low-precision compositor or encoded proxy

See `docs/44_LOSSLESS_MEDIA_POLICY.md` for the capture-to-master fidelity boundary and exact decoded comparison tests.
