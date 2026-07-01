# GLB Sprite Renderer

A small local Three.js utility for rendering animated `.glb` models into transparent PNG sprite frames and Killbox-style 8-direction sprite sheets.

## Run

From this repository root:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/tools/glb-sprite-renderer/
```

The page uses browser-native file input, so selected `.glb` files stay local to your machine. Three.js is loaded from a pinned CDN URL, so the browser needs internet access the first time it opens the tool.

## Use

1. Choose a local `.glb` model.
2. If the GLB contains animation clips, choose the clip to preview and export. If there is only one clip, it is selected automatically.
3. Adjust the camera angle, orthographic scale, model rotation, model vertical offset, frame size, frame count, and playback speed.
4. Use **Export current PNG** for one transparent frame.
5. Use **Export 8-direction animation sheet** for a transparent animated sheet.

## Recommended Killbox Settings

- Frame size: `256`
- Directions: `8`
- Frames per direction: `4`
- Background: transparent
- Camera: orthographic
- Camera angle: top-down/isometric, then tune by eye for readability

For 4 frames at 256 px, the exported sheet is:

```text
width  = 4 * 256 = 1024
height = 8 * 256 = 2048
```

## Sprite Sheet Layout

Rows are directions:

```text
0 south
1 southeast
2 east
3 northeast
4 north
5 northwest
6 west
7 southwest
```

Columns are animation frames sampled evenly across one loop:

```text
frame 0, frame 1, frame 2, frame 3, ...
```

The model is rotated by 45-degree increments for each direction row. The **Model rotation** control sets the base facing direction before those increments are applied.

## Frame Bounds And Padding

Enable **show frame bounds** when tuning the preview to see the square frame edge. The exported PNG remains transparent.

The tool keeps the full square frame for now. If the character appears tiny because of transparent padding, Killbox can crop or trim transparent padding at draw time later without changing the source sheet.
