---
name: update-changelog
description: Update the Adimology changelog after shipping changes — adds a new entry to README.md and keeps only the 3 most recent versions there, archiving older entries to CHANGELOG.md. Use when the user asks to "update changelog", "tolong update changelog", or after a batch of features/fixes is ready to log.
---

# Update Changelog

Adimology keeps changelog history split across two files:

- **[README.md](../../../README.md)** — `## Changelog` section holds only the **3 most recent versions**, newest first, so the README stays scannable.
- **[CHANGELOG.md](../../../CHANGELOG.md)** — full archive of every older version, newest-first, with a one-line pointer back to the README at the top.

## Steps

1. **Figure out what changed.** Use `git log` (recent commits) and/or ask the user which changes to log. Group related commits into one version entry when they belong together (e.g. an optimization commit + the feature it optimizes).

2. **Pick the next version number.** Look at the current top entry in README.md's Changelog section (format `vMAJOR.MINOR.PATCH`). Bump PATCH for small fixes/tweaks, MINOR for new features, following whatever pattern the last few bumps used. Use today's date (`YYYY-MM-DD`).

3. **Write the entry** in the existing style — a `### vX.Y.Z (YYYY-MM-DD)` heading followed by bullet points, each starting with a **bold short title**, in Bahasa Indonesia, matching the tone of existing entries (see either file for examples). Keep bullets factual and specific (what changed, from what to what) rather than vague.

4. **Insert the new entry** at the top of the `## Changelog` section in README.md, right after the `## Changelog` heading.

5. **Enforce the 3-version cap in README.md.** After inserting, count the `### v` entries in README's Changelog section. If there are more than 3:
   - Cut every entry beyond the 3rd (in order, oldest of the extras first).
   - Prepend those cut entries — verbatim, same order (newest-first) — to the top of CHANGELOG.md, right after its intro line (`Riwayat lengkap perubahan Adimology...`).
   - Make sure README.md still ends its Changelog section with the archive pointer line:
     ```
     📜 Riwayat versi sebelumnya ada di **[CHANGELOG.md](CHANGELOG.md)**.
     ```
     immediately before the closing `---`.

6. **Sanity check** both files render correctly (heading levels consistent, no orphaned `---`, CHANGELOG.md's intro line still present) before finishing.

## Notes

- Never delete changelog content — only move it between the two files.
- If CHANGELOG.md doesn't exist yet, create it with this header before archiving anything:
  ```markdown
  # Changelog

  Riwayat lengkap perubahan Adimology. 3 versi terbaru selalu ditampilkan di [README.md](README.md#changelog); versi yang lebih lama diarsipkan di sini.
  ```
- Don't touch other README sections (Fitur Utama, Environment Variables, etc.) as part of this task.
