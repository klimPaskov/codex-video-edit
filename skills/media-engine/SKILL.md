---
name: media-engine
description: Implement deterministic ingest, transcription, rendering, audio, timing, and media QA.
---

# Media engine

## Use when

Changing FFmpeg, ffprobe, transcription, proxies, render, mux, export, or media validation.

## Rules

- Integer microsecond authoritative time.
- Rational frame rates.
- Typed process adapter with argument arrays, timeouts, cancellation, redaction, and stable errors.
- Hash all important inputs and outputs.
- Stage to temporary paths, validate, then promote atomically.
- Reuse cache only when keys and output hashes match.
- Preserve source bytes.

## Required checks

- decode
- streams and codecs
- duration and frame count
- source-to-output mapping
- A/V drift
- caption timing
- loudness and clipping
- black and frozen frames
- missing media
- output hash

## Evidence

Render a short fixture whenever media behavior changes. Inspect frames and audio. A successful FFmpeg exit is not enough.
