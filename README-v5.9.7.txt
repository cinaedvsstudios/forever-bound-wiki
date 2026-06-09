Capsanoto v5.9.7 brightness / bookmark / accent refinement

Rollback anchor:
- v5.9.6 TCard rail/settings/shadow repair

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Brightened the top-left Capsanoto name/version lockup.
   - Stronger cream/gold text treatment.
   - More drop shadow/glow so it is easier to read.

2. Writing Room title text is now brighter, with gold/cream emphasis.

3. The writing document title strip now has a purple gradient.

4. Reduced Writing Assist Rail bookmark spam.
   - Previous behaviour: every h1/h2/h3 heading was treated as a bookmark marker.
   - New behaviour: only explicit bookmarks created with the Bookmark tool appear as 🔖.
   - The document title is no longer treated as a bookmark marker.

5. Improved left Writing Assist Rail marker movement.
   - Positioning is now calculated relative to the rail itself, so icons update more reliably when the editor scrolls.

6. Added secondary accent colours:
   - cyan #0070b6 for currently selected/active things
   - gold #b67300 for control panel borders and warmth

7. Settings panel is less flat/monotone.
   - More layered gradients.
   - Gold borders around control panels.
   - Cyan active selected states.
   - Deeper shadows.

8. Version/cache bumped to v5.9.7 and design key bumped to load clean defaults.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace these changed files with v5.9.6 copies if needed.

Full package excludes older image assets but includes required table icon assets.
