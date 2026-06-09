Capsanoto v5.9.8 title/color chip repair

Rollback anchor:
- v5.9.7 brightness/bookmark/accent refinement

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. The document title bar now uses a purple gradient matched to the top of the left writing rail.
2. The document title input no longer shows the accidental black input-box rectangle.
3. Settings colour chips now show the actual selected/favourite colours inside the pill.
4. Favourite colour hex text automatically switches between cream and dark text depending on the chip brightness.
5. The current colour preview pill also shows the real current colour and uses readable contrast text.
6. Native colour inputs are kept visually truthful instead of inheriting the global button gradient.
7. Version/cache bumped to v5.9.8 and design key bumped to load clean defaults.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace these changed files with v5.9.7 copies if needed.

Full package excludes older image assets but includes required table icon assets.
