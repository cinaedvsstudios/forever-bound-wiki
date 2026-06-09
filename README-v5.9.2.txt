Capsanoto v5.9.2 obsidian leather default theme

Rollback anchor:
- v5.9.1 debug + subfiles support

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Theme direction:
- Left writing rail remains a purple gradient.
- Cards, panels, menus, TCards, emphasis boxes, and tables now use semi-transparent brown layers so the leather/background texture remains visible.
- Core brown: #1c120e
- Darkest brown: #100a09
- Border/outline/secondary text/scrollbar: #615243
- Highlight/headings/main readable text: #fff0ce
- Purple accent/pills/selected UI: #5f1e66
- Supporting neutrals: #363532 and #171013

Implementation:
- Bumped design storage key and theme version so the new defaults load instead of old saved design variables.
- Updated Capsanoto palette and favorite colours.
- Updated default design settings and forced reset theme.
- Added CSS theme layer for transparent leather panels, purple pills, darker inputs, softer menus, and slim scrollbars.
- Updated static HTML version/cache links to v5.9.2.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace the changed files with v5.9.1 copies if needed.

Full package excludes older image assets but includes required table icon assets.
