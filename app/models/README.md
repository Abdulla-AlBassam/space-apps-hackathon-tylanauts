# 3D body model

`body.glb` is the anatomy model used by the body map (`../body-map.html`).

## Where it comes from and its licence

It is made from **BodyParts3D**, a free 3D atlas of an adult male body:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

- Licence page: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (checked 14 Nov 2026: CC BY 4.0)
- Download page: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html (file `isa_BP3D_4.0_obj_99.zip`)
- CC BY 4.0 lets us use, change and share it, including in a public demo, **as long as we credit it**.
  The body map page shows the credit at the bottom. Keep it there, and add it to the pitch slides
  if the 3D body appears in them.
- Note: the text inside the downloaded OBJ files still names the older licence
  (CC Attribution-Share Alike 2.1 Japan). The current licence page says CC BY 4.0. Either way the
  credit above is required. To be safe, share our changed `body.glb` under the same terms as the
  original if anyone asks to reuse it.

## What we changed

`tools/build_body_model.py` takes the original files and:

1. Picks out the bones, the spine and hip bones (as a separate part so they can be highlighted),
   the heart walls, the brain, the eyes, the front thigh muscles and the skin.
2. Turns them so the figure stands upright facing forward, in metres, feet at 0.
3. Reduces the detail (about 200,000 triangles in total) so the file is about 3.8 MB.
4. Saves one named part per group: `skeleton`, `spine`, `heart`, `brain`, `eyes`, `muscle`, `skin`.

To rebuild it:

```
pip install trimesh fast-simplification numpy
# download and unzip isa_BP3D_4.0_obj_99.zip, plus isa_element_parts.txt from
# https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/, into one folder
python3 tools/build_body_model.py <that folder> app/models/body.glb
```
