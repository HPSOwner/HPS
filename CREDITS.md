# 3D Model Credits

All models are licensed under [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) via Sketchfab. Commercial use is allowed; attribution is required.

- **Glock 19** — "G19 Pistol, Game Ready, Free version" by [Rotuma](https://sketchfab.com/Rotuma) — https://sketchfab.com/3d-models/g19-pistol-game-ready-free-version-e3412d9803f04bdaa97ad9b68ed665d7
  - The original download (`glock19.glb`) turned out to be a baked "display" composition containing **two complete pistols** fused into one mesh (confirmed via a mesh-connectivity analysis: 622 disconnected geometry islands, k-means-clustered into two matching gun-shaped groups ~300/322 pieces each). Fixed by separating the mesh by loose parts in Blender, keeping one gun + its one magazine, rejoining, and re-exporting as `glock19_single.glb` — same sculpted geometry by Rotuma, just the duplicate removed. See `reference/blender_analyze.py` and `reference/blender_export_clean.py` for the exact process.
  - That remaining copy is still one fused mesh (gun body + its own magazine aren't separate objects), so no 3D field-strip animation is possible for this weapon — the Blueprint panel's animated schematic covers disassembly instead.
- **MP5** — "MP5 Submachine Gun" by [Rotuma](https://sketchfab.com/Rotuma) — https://sketchfab.com/3d-models/mp5-submachine-gun-a73b61932a0e4eecb5db5c63c158aa24
  - Cleanly separated parts (Bolt, Trigger, CH, Receiver, Barrel, Stock, Mag, FS). Field-strip animation follows the real MP5 order: magazine out, buttstock off, bolt group pulled out the rear, trigger group drops out. The barrel is pinned/fixed on a real MP5 and isn't part of a basic field strip, so it (along with the front sight and receiver) deliberately stays put.
- **Weapon Case** — "Weapon case" by [Foxx Assets](https://sketchfab.com/FoxxAssets) — https://sketchfab.com/3d-models/weapon-case-09ad8a4a532645fa9d36cdcdd0300e2c

## Removed

- **Uzi** by Jusai — removed. Its 22 mesh parts are all generic Blender export names (`Cube`, `Cube.001`, …) with no semantic labeling, so there's no reliable way to identify which chunk is the magazine/bolt/etc. for a field-strip animation.
- Two earlier Glock replacement attempts (a NIXO G17 with genuinely separate parts, and Rotuma's TTI Pit Viper) were tried and reverted per explicit instruction to use Rotuma's G19 specifically.

## Blueprint reference diagrams

The in-game "Official Patent Reference" tab uses real public-domain US patent drawings, not manufacturer-copyrighted technical manuals:

- **Glock 19** — US Patent 4,539,889, Gaston Glock, "Automatic Pistol with Counteracting Spring Control Mechanism," filed 1982, granted Sep. 10, 1985. Full assembled + exploded views. `public/reference/glock_patent_fig1-4.png`.
- **MP5** — US Patent 3,283,435, Theodor Koch (Heckler & Koch GmbH), "Breech Closure," filed 1964, granted Nov. 8, 1966. Covers the roller-delayed breech mechanism at the core of the MP5 — no public-domain full-weapon exploded diagram was found (HK's complete factory parts diagrams are commercially copyrighted), so this patent covers the bolt/breech only. `public/reference/mp5_patent_breech.png`.

Still needed: AK-47 and M4 Carbine (candidates identified earlier, not yet downloaded).
