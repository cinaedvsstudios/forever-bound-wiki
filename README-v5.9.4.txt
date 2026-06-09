Capsanoto v5.9.4 emoji gradient polish

Rollback anchor:
- v5.9.3 purple glow card theme

Files changed:
- app.js
- styles.css
- editor.html
- index.html
- writing-room.html

Change list:
1. Added emoji labels to Settings tabs:
   🎨 Design, 📥 Download, ❓ Help, 📤 Import File, ✨ Emoji, 🧭 Command Layout, 💾 Local Backup, 🧪 Debug.

2. Updated menu tool icons toward emoji-first controls:
   📝 Text, 🅱️ Bold, ✒️ Italic, 📋 List, 🔠 H1, 🔡 H2, 🔤 H3, ↔️ Align, 🖼️ Image, 🧮 Table, 🧩 TCard, ➖ Rule, 📦 Box, ✨ Emoji.
   Note: H1/H2/H3 and TCard do not have perfect standard emoji matches, so these are temporary best-fit placeholders.

3. Links are now purple and underlined globally, including Settings preview links, so browser-blue links should not appear.

4. Buttons now use subtle brown-to-purple gradients instead of flat solid fills.

5. Floating panel header bars now use purple gradients: Settings, Writing Room, Help, Transclusion Cards, Project Settings, and Emoji Spark.

6. Filing Cabinet document pills now have a darker gray/brown/purple gradient instead of flat gray.

7. Filing Cabinet emojis/icons no longer have circular borders by default; they are displayed as bare emoji/icon glyphs with drop shadows.

8. Emoji Spark layout repaired:
   - corrected search row column order
   - constrained custom icon images
   - made the picker flex/scroll correctly
   - improved selected/hover styling

9. Version/cache bumped to v5.9.4.

Checks:
- node --check app.js
- HTML parser checks for editor.html, index.html, writing-room.html

Rollback:
- Replace changed files with v5.9.3 copies if needed.

Full package excludes older image assets but includes required table icon assets.
