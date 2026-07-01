import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DIRECTION_NAMES = [
  "south",
  "southeast",
  "east",
  "northeast",
  "north",
  "northwest",
  "west",
  "southwest",
];

const controls = {
  modelInput: document.querySelector("#modelInput"),
  clipSelect: document.querySelector("#clipSelect"),
  cameraAngle: document.querySelector("#cameraAngle"),
  orthoScale: document.querySelector("#orthoScale"),
  modelRotation: document.querySelector("#modelRotation"),
  verticalOffset: document.querySelector("#verticalOffset"),
  frameSize: document.querySelector("#frameSize"),
  frameCount: document.querySelector("#frameCount"),
  playbackSpeed: document.querySelector("#playbackSpeed"),
  showBounds: document.querySelector("#showBounds"),
  exportCurrent: document.querySelector("#exportCurrent"),
  exportSheet: document.querySelector("#exportSheet"),
};

const labels = {
  cameraAngle: document.querySelector("#cameraAngleValue"),
  orthoScale: document.querySelector("#orthoScaleValue"),
  modelRotation: document.querySelector("#modelRotationValue"),
  verticalOffset: document.querySelector("#verticalOffsetValue"),
  frameCount: document.querySelector("#frameCountValue"),
  playbackSpeed: document.querySelector("#playbackSpeedValue"),
  clipInfo: document.querySelector("#clipInfo"),
  status: document.querySelector("#status"),
  modelName: document.querySelector("#modelName"),
};

const canvasWrap = document.querySelector("#canvasWrap");
const scene = new THREE.Scene();
const loader = new GLTFLoader();
const modelRoot = new THREE.Group();
const renderTarget = new THREE.Vector3(0, 0, 0);
const clock = new THREE.Clock();

let loadedModel = null;
let currentObjectUrl = null;
let currentFileBase = "hero-joel";
let clips = [];
let mixer = null;
let activeAction = null;
let previewSize = 512;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});

renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
canvasWrap.appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
scene.add(modelRoot);

// Even lighting gives sprite exports a readable game-art base.
scene.add(new THREE.AmbientLight(0xffffff, 1.8));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

function setStatus(message) {
  labels.status.textContent = message;
}

function getFrameSize() {
  return Number.parseInt(controls.frameSize.value, 10);
}

function getFrameCount() {
  return Number.parseInt(controls.frameCount.value, 10);
}

function getSelectedClip() {
  const index = Number.parseInt(controls.clipSelect.value, 10);
  return clips[index] ?? clips[0] ?? null;
}

function updateReadouts() {
  labels.cameraAngle.textContent = `${controls.cameraAngle.value} deg`;
  labels.orthoScale.textContent = Number.parseFloat(controls.orthoScale.value).toFixed(1);
  labels.modelRotation.textContent = `${controls.modelRotation.value} deg`;
  labels.verticalOffset.textContent = Number.parseFloat(controls.verticalOffset.value).toFixed(2);
  labels.frameCount.textContent = `${getFrameCount()} frame${getFrameCount() === 1 ? "" : "s"}`;
  labels.playbackSpeed.textContent = `${Number.parseFloat(controls.playbackSpeed.value).toFixed(2)}x`;
  canvasWrap.classList.toggle("show-bounds", controls.showBounds.checked);
}

function updateCamera() {
  const viewSize = Number.parseFloat(controls.orthoScale.value);
  camera.left = -viewSize / 2;
  camera.right = viewSize / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;

  const elevation = THREE.MathUtils.degToRad(Number.parseFloat(controls.cameraAngle.value));
  const azimuth = THREE.MathUtils.degToRad(45);
  const distance = 10;
  const horizontal = Math.cos(elevation) * distance;

  camera.position.set(
    Math.sin(azimuth) * horizontal,
    Math.sin(elevation) * distance,
    Math.cos(azimuth) * horizontal,
  );
  camera.lookAt(renderTarget);
  camera.updateProjectionMatrix();
}

function updateModelTransform(rotationDegrees = Number.parseFloat(controls.modelRotation.value)) {
  modelRoot.rotation.y = THREE.MathUtils.degToRad(rotationDegrees);
  modelRoot.position.y = Number.parseFloat(controls.verticalOffset.value);
}

function renderScene(rotationDegrees = Number.parseFloat(controls.modelRotation.value)) {
  updateReadouts();
  updateCamera();
  updateModelTransform(rotationDegrees);
  renderer.render(scene, camera);
}

function resizePreview() {
  const bounds = canvasWrap.getBoundingClientRect();
  previewSize = Math.max(128, Math.floor(Math.min(bounds.width, bounds.height) - 36));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(previewSize, previewSize, false);
  renderScene();
}

function frameRender(size, rotationDegrees) {
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderScene(rotationDegrees);
}

function restorePreview() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(previewSize, previewSize, false);
  renderScene();
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function normalizeModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const largestAxis = Math.max(size.x, size.y, size.z) || 1;

  object.position.sub(center);
  object.scale.setScalar(2.2 / largestAxis);
}

function readableSourceName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("run")) return "hero-joel-run";
  if (lower.includes("walk")) return "hero-joel-walk";
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "hero-joel";
}

function readableClipName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("run")) return "run";
  if (lower.includes("walk")) return "walk";
  return lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "anim";
}

function currentExportBase() {
  const clip = getSelectedClip();
  const clipSlug = clip ? readableClipName(clip.name) : "";
  if (currentFileBase.includes("walk") || currentFileBase.includes("run") || !clipSlug) {
    return currentFileBase;
  }
  return `${currentFileBase}-${clipSlug}`;
}

function clearAnimationState() {
  if (activeAction) {
    activeAction.stop();
    activeAction = null;
  }
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
  clips = [];
  controls.clipSelect.innerHTML = '<option value="">No animation loaded</option>';
  controls.clipSelect.disabled = true;
  labels.clipInfo.textContent = "Select an animated GLB.";
}

function populateClips(gltf) {
  clips = gltf.animations ?? [];
  controls.clipSelect.innerHTML = "";

  if (clips.length === 0) {
    controls.clipSelect.innerHTML = '<option value="">No animation clips found</option>';
    controls.clipSelect.disabled = true;
    labels.clipInfo.textContent = "This GLB has no animation clips.";
    return;
  }

  clips.forEach((clip, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${clip.name || "Animation"} (${clip.duration.toFixed(2)}s)`;
    controls.clipSelect.appendChild(option);
  });

  controls.clipSelect.value = "0";
  controls.clipSelect.disabled = false;
  labels.clipInfo.textContent = `${clips.length} clip${clips.length === 1 ? "" : "s"} detected.`;
}

function selectClip() {
  const clip = getSelectedClip();
  if (!mixer || !clip) return;

  if (activeAction) activeAction.stop();
  activeAction = mixer.clipAction(clip);
  activeAction.reset();
  activeAction.setLoop(THREE.LoopRepeat, Infinity);
  activeAction.clampWhenFinished = false;
  activeAction.play();
  labels.clipInfo.textContent = `Previewing ${clip.name || "animation"} (${clip.duration.toFixed(2)}s).`;
}

async function loadModel(file) {
  if (!file) return;

  setStatus("Loading model...");
  controls.exportCurrent.disabled = true;
  controls.exportSheet.disabled = true;
  clearAnimationState();

  if (loadedModel) {
    modelRoot.remove(loadedModel);
    disposeObject(loadedModel);
    loadedModel = null;
  }

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = URL.createObjectURL(file);
  currentFileBase = readableSourceName(file.name);

  try {
    const gltf = await loader.loadAsync(currentObjectUrl);
    loadedModel = gltf.scene;
    normalizeModel(loadedModel);
    modelRoot.add(loadedModel);
    labels.modelName.textContent = file.name;

    mixer = new THREE.AnimationMixer(loadedModel);
    populateClips(gltf);
    selectClip();

    controls.exportCurrent.disabled = false;
    controls.exportSheet.disabled = clips.length === 0;
    setStatus(clips.length > 0 ? "Animated model ready." : "Model ready; no animations found.");
    renderScene();
  } catch (error) {
    console.error(error);
    labels.modelName.textContent = "Load failed";
    setStatus("Could not load that GLB file.");
  }
}

function exportCurrentPng() {
  if (!loadedModel) return;

  const size = getFrameSize();
  frameRender(size, Number.parseFloat(controls.modelRotation.value));
  downloadCanvas(renderer.domElement, `${currentExportBase()}-current-${size}.png`);
  restorePreview();
}

function sampleAnimationAt(time) {
  if (!mixer || !activeAction) return;
  activeAction.paused = false;
  activeAction.enabled = true;
  mixer.setTime(time);
}

function exportAnimationSheet() {
  const clip = getSelectedClip();
  if (!loadedModel || !clip) return;

  const size = getFrameSize();
  const frames = getFrameCount();
  const sheet = document.createElement("canvas");
  sheet.width = frames * size;
  sheet.height = DIRECTION_NAMES.length * size;

  const context = sheet.getContext("2d");
  context.clearRect(0, 0, sheet.width, sheet.height);

  const baseRotation = Number.parseFloat(controls.modelRotation.value);
  const previousMixerTime = mixer.time;

  // Columns are sampled evenly across one loop; rows rotate through Killbox's 8 directions.
  for (let row = 0; row < DIRECTION_NAMES.length; row += 1) {
    const rotation = baseRotation + row * 45;
    for (let column = 0; column < frames; column += 1) {
      const sampleTime = (clip.duration * column) / frames;
      sampleAnimationAt(sampleTime);
      frameRender(size, rotation);
      context.drawImage(renderer.domElement, column * size, row * size, size, size);
    }
  }

  sampleAnimationAt(previousMixerTime);
  downloadCanvas(sheet, `${currentExportBase()}-8dir-${frames}frame.png`);
  restorePreview();
}

function animate() {
  requestAnimationFrame(animate);

  if (mixer && activeAction) {
    const speed = Number.parseFloat(controls.playbackSpeed.value);
    mixer.update(clock.getDelta() * speed);
  } else {
    clock.getDelta();
  }

  renderScene();
}

for (const control of [
  controls.cameraAngle,
  controls.orthoScale,
  controls.modelRotation,
  controls.verticalOffset,
  controls.frameSize,
  controls.frameCount,
  controls.playbackSpeed,
  controls.showBounds,
]) {
  control.addEventListener("input", renderScene);
}

controls.clipSelect.addEventListener("change", selectClip);
controls.modelInput.addEventListener("change", (event) => {
  loadModel(event.target.files?.[0]);
});

controls.exportCurrent.addEventListener("click", exportCurrentPng);
controls.exportSheet.addEventListener("click", exportAnimationSheet);
window.addEventListener("resize", resizePreview);

resizePreview();
animate();
