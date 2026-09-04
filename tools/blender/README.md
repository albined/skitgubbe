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
