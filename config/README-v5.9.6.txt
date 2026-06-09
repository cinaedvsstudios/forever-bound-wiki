Capsanoto v5.9.6 TCard rail/settings/shadow repair

Rollback anchor:
- v5.9.5 logo/table/controls/rail polish

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. TCard styling now respects the TCard control panel again.
   - TCard background, border, text, heading/accent and size come from the TCard style variables.
   - The later theme rules no longer force every TCard border/accent to the global theme colour.
   - TCard list rows in the Transclusion Cards panel now also receive each TCard's own style variables.

2. Writing assist rail marker icons updated:
   - TCard = Capsanoto logo image (iconcapsanoto.png)
   - Bookmark = 🔖
   - Table = 🧮
   - Link = 🔗
   - Box / emphasis box = 📦
   - Deprecated paragraph = 🕰️

3. Writing Room right navigation rail fixed.
   - The rail is no longer sticky/float inside the scrolling content.
   - It is rendered as a direct child of the Writing Room panel and absolutely anchored to the right side.
   - It should stay visible while the Filing Cabinet content scrolls without overlapping cards in the broken way.

4. Settings Element Designer now uses the wide space properly.
   - The preview column remains on the right.
   - Open settings cards use true two-column controls on the left.
   - URL/text fields get wider control space.
   - Smaller screens fall back to one column.

5. Added stronger drop shadow under every pill/box/button/control family.

6. Version/cache bumped to v5.9.6 and design key bumped to load clean defaults.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace these changed files with v5.9.5 copies if needed.

Full package excludes older image assets but includes required table icon assets.
