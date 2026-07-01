# GLB Sprite Renderer

A small local browser tool for turning animated `.glb` files into transparent PNG sprite sheets.

The tool is aimed at 2D game projects that have animated 3D character exports but are not ready to ship live 3D at runtime. It loads a local GLB in the browser, previews the selected animation with Three.js, and exports an 8-direction sprite sheet.

## Open The Tool

Serve this repository locally:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/tools/glb-sprite-renderer/
```

## Features

- Local `.glb` file input
- Three.js `GLTFLoader` support
- Animation clip detection and selection
- Orthographic transparent preview
- Camera angle, scale, model rotation, vertical offset, frame size, frame count, and playback speed controls
- Current-frame PNG export
- 8-direction animated PNG sprite sheet export

See [tools/glb-sprite-renderer/README.md](tools/glb-sprite-renderer/README.md) for detailed usage and sheet layout.
