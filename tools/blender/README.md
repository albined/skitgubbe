# Lobby room export

`export_lobby_scene.py` turns the Blender room into the mobile-friendly GLB
used by the lobby. It keeps the active Blender camera, removes meshes that stay
outside the small camera movement range, keeps the original diffuse textures,
and bakes only the original Cycles illumination into a separate lightmap. The
resulting scene needs no real-time lights or shadows.

The script never overwrites its input file. From WSL, run:

```bash
"/mnt/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" \
  --background "C:\\Users\\albin\\Downloads\\Serena.blend" \
  --python "\\\\wsl.localhost\\Ubuntu\\home\\albin\\egna_proj\\skitgubbe\\tools\\blender\\export_lobby_scene.py" \
  -- \
  --output-blend "C:\\Users\\albin\\Downloads\\Serena-web.blend" \
  --output-glb "\\\\wsl.localhost\\Ubuntu\\home\\albin\\egna_proj\\skitgubbe\\packages\\web\\static\\lobby\\serena-room.glb" \
  --preview-dir "\\\\wsl.localhost\\Ubuntu\\tmp\\serena-web-previews"

convert packages/web/static/lobby/serena-room-lightmap.webp \
  -blur 0x3 -quality 92 \
  packages/web/static/lobby/serena-room-lightmap.webp
```

Defaults are a 2048px lighting atlas and 128 Cycles samples. The gentle blur
removes residual Monte Carlo noise from the low-frequency lightmap without
softening the original material textures. For a quick structural test, add
`--bake-size 512 --bake-samples 1`. Use `--bake-size 0` only when diagnosing the
dynamic PBR-material conversion.

## Kiryu sofa cameo

`export_kiryu_cameo.py` extracts the `BASE` and `c_am_kiryu` collections from
`Kiryu_Kazuma_Y6_V.1.2.blend` (white suit and red shirt). It preserves mesh object
transforms, builds a seated 19-bone skeleton, reduces geometry, caps textures at
512px, and exports compressed colour textures while retaining hair transparency.
The original `.blend` is never overwritten. The current export is about 3.1 MB,
compared with the 93.9 MB source, with roughly 25,000 vertices.
The seated pose leans into the backrest with uneven leg placement; trouser weights
blend across the centre seam to avoid pulling the crotch apart. Runtime bone motion
adds breathing, occasional glances, arm stretches, a thigh scratch, and gentle
neck rolls. Over a two-minute cycle he also eases into a second pose: right arm
along the backrest and left ankle on the right knee. Hand and foot targets keep
the supporting foot planted and lift the crossing foot over the other knee.
The export also welds coincident trouser vertices and smooths the compressed
front hip fabric after posing, with the waistband and leg silhouettes protected.
Trouser shading normals are regenerated for the corrected geometry. This is
baked into the asset and adds no runtime cloth simulation.

```bash
"/mnt/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" \
  --background --disable-autoexec 'C:\Users\albin\Downloads\Kiryu_Kazuma_Y6_V.1.2.blend' \
  --python '\\wsl.localhost\Ubuntu\home\albin\egna_proj\skitgubbe\tools\blender\export_kiryu_cameo.py' \
  -- --output '\\wsl.localhost\Ubuntu\home\albin\egna_proj\skitgubbe\packages\web\static\lobby\kiryu-sofa.glb'
```

The optimized GLB is included in the app; the source Blender file is not.
The signed-in lobby loads it only during local evening hours (19:00–23:00), with a 50% chance per local
calendar day. The daily decision is saved on each device/browser so reloads do
not reroll it; if storage is blocked, it lasts for the current session only.
Append `?kiryu=1` to bypass both the schedule and daily chance for preview,
or `?kiryu=0` to disable it.
Reduced-motion mode uses the existing static room and does not load the cameo.
Missing assets leave the rest of the lobby working.

Use `?kiryu=1&time=day` (or `&time=12`) for daylight preview lighting.
`time` accepts whole hours from 0 to 23; omitting it restores the real local time.
This changes room and character lighting, independently of cameo visibility.
Append `&pose=lounge`, `&pose=stretch`, `&pose=scratch`, or `&pose=neck` to start
the animation at that gesture for review. Playback continues normally afterwards.

The source file credits the original model port to **Z64Gaming** and the rig to
**OutlawArt1923**. Character/model: SEGA / Ryu Ga Gotoku Studio. The uploader's
stated licence is CC BY-NC-ND 4.0. The converted model is included at
`packages/web/static/lobby/kiryu-sofa.glb`.

If another app occupies port 3000, point the web preview at a running game
backend with `DEV_API_TARGET=http://localhost:8091 bun --filter web dev --port 5174`.
