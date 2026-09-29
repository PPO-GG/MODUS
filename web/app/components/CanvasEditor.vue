<template>
  <div class="rce font-sans flex flex-col h-full select-none">
    <!-- TOP TOOLBAR -->
    <CanvasToolbar />

    <!-- MAIN EDITOR AREA -->
    <div class="flex-1 flex min-h-0 gap-px rce-glass-panel">
      <!-- LEFT PANEL: Presets, Tools + Layers -->
      <CanvasLeftPanel />

      <!-- CENTER: Interactive Konva Canvas -->
      <CanvasStage />

      <!-- RIGHT PANEL: Property Inspector -->
      <CanvasInspector />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  toRef,
} from "vue";
import type {
  CanvasElement,
  CanvasTemplate,
  AlignDirection,
} from "~/utils/canvas-editor/types";
import type {
  CanvasPreset,
  CanvasProfile,
} from "~/utils/canvas-editor/profile";
import {
  MAX_IMAGE_LAYERS,
  elementLabel,
  elementTypeIcon,
  imageLayerCount,
  previewText as previewTextWith,
  scaleElementSize as scaleElementSizeWith,
} from "~/utils/canvas-editor/elements";
import {
  alignDelta,
  distributeDeltas,
  rotateAround,
  unionRect,
} from "~/utils/canvas-editor/geometry";
import {
  gradientFillProps,
  gradientStrokeProps,
} from "~/utils/canvas-editor/gradient-props";
import { remeasureText } from "~/utils/konva-text";
import { useGoogleFonts } from "~/composables/useGoogleFonts";
import { useCanvasHistory } from "~/composables/canvas-editor/useCanvasHistory";
import { useCanvasViewport } from "~/composables/canvas-editor/useCanvasViewport";
import { useCanvasShortcuts } from "~/composables/canvas-editor/useCanvasShortcuts";
import { useCanvasImages } from "~/composables/canvas-editor/useCanvasImages";
import { provideCanvasEditor } from "~/composables/canvas-editor/useCanvasEditorContext";
import CanvasToolbar from "~/components/canvas-editor/CanvasToolbar.vue";
import CanvasLeftPanel from "~/components/canvas-editor/CanvasLeftPanel.vue";
import CanvasStage from "~/components/canvas-editor/CanvasStage.vue";
import CanvasInspector from "~/components/canvas-editor/CanvasInspector.vue";

const { loadFont, loadTemplateFonts } = useGoogleFonts();

const props = defineProps<{
  modelValue: CanvasTemplate;
  guildId: string;
  profile: CanvasProfile;
}>();

const toast = useToast();

// The template is owned by the host page (a reactive object). The editor edits
// it in place. To discard changes the host swaps in a restored object and
// remounts the editor with a new key.
const template = computed(() => props.modelValue);

/** Swaps the whole design in place (preset, reset, undo, redo) so the host's object stays the one in use. */
function replaceTemplate(next: CanvasTemplate) {
  const t = template.value;
  t.canvasWidth = next.canvasWidth;
  t.canvasHeight = next.canvasHeight;
  t.backgroundColor = next.backgroundColor;
  if (next.backgroundImage) t.backgroundImage = next.backgroundImage;
  else delete t.backgroundImage;
  t.elements = next.elements;
}

const selectedElementIds = ref<Set<string>>(new Set());
const selectedElementId = computed(() =>
  selectedElementIds.value.size === 1
    ? [...selectedElementIds.value][0]!
    : null,
);

const stageRef = ref<any>(null);
const textFieldRef = ref<HTMLTextAreaElement | null>(null);
const transformerRef = ref<any>(null);
const transformerRevision = ref(0);
const canvasWrap = ref<HTMLElement | null>(null);
const isSpaceHeld = ref(false);
const isShiftHeld = ref(false);
const isPanning = ref(false);
const {
  zoomMultiplier,
  scaleFactor,
  handlePanStart,
  handlePanMove,
  handlePanEnd,
  handleWheelZoom,
} = useCanvasViewport({ canvasWrap, template, isSpaceHeld, isPanning });

// ── Undo/Redo History ──────────────────────────────────────────────────

function pruneSelectionToExisting() {
  selectedElementIds.value = new Set(
    [...selectedElementIds.value].filter((id) =>
      template.value.elements.some((el) => el.id === id),
    ),
  );
}

const history = useCanvasHistory(
  template,
  replaceTemplate,
  pruneSelectionToExisting,
);
const { canUndo, canRedo, undo, redo } = history;

// ── Background Image & Image Layers ────────────────────────────────────

const {
  imageObjects,
  imageCache,
  bgImageObj,
  bgImageFile,
  bgUploading,
  imageUploadInput,
  replacingImageId,
  removeBgImage,
  handleImageFileSelection,
} = useCanvasImages({
  template,
  profile: toRef(props, "profile"),
  guildId: toRef(props, "guildId"),
  toast,
  stageRef,
  selectedElementIds,
  rebindTransformer,
  nextElementCounter: () => ++elementCounter,
});

function applyPreset(preset: CanvasPreset) {
  const bgImage = template.value.backgroundImage;
  replaceTemplate(JSON.parse(JSON.stringify(preset.template)));
  if (bgImage) template.value.backgroundImage = bgImage;
  selectedElementIds.value = new Set();
}

const reversedElements = computed(() => [...template.value.elements].reverse());

const selectedElement = computed(() => {
  if (!selectedElementId.value) return null;
  return (
    template.value.elements.find((el) => el.id === selectedElementId.value) ||
    null
  );
});

function swatchPreview(value?: string): string {
  return value || "#ffffff";
}

const selectedElementOpacityPct = computed({
  get: () => Math.round((selectedElement.value?.opacity ?? 1) * 100),
  set: (v: number) => {
    if (selectedElement.value) selectedElement.value.opacity = v / 100;
  },
});

// ── Transformer ────────────────────────────────────────────────────────

const transformerNodes = computed(() => {
  transformerRevision.value;
  if (!stageRef.value || selectedElementIds.value.size === 0) return [];
  try {
    const stage = stageRef.value.getNode();
    if (!stage) return [];
    return [...selectedElementIds.value]
      .filter(
        (id) =>
          template.value.elements.find((el) => el.id === id)?.type !== "line",
      )
      .map((id) => stage.findOne(`.${id}`))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
  } catch {
    return [];
  }
});

const hoveredElementId = ref<string | null>(null);

const hoveredElementRect = computed(() => {
  if (
    !hoveredElementId.value ||
    hoveredElementId.value === selectedElementId.value
  )
    return null;
  if (!stageRef.value) return null;
  try {
    const stage = stageRef.value.getNode();
    if (!stage) return null;
    const node = stage.findOne(`.${hoveredElementId.value}`);
    if (!node) return null;
    return node.getClientRect({ relativeTo: stage });
  } catch {
    return null;
  }
});

const groupBounds = ref<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);
const groupRotationInput = ref(0);

function getElementRect(
  id: string,
): { x: number; y: number; width: number; height: number } | null {
  if (!stageRef.value) return null;
  try {
    const stage = stageRef.value.getNode();
    if (!stage) return null;
    const node = stage.findOne(`.${id}`);
    if (!node) return null;
    const rect = node.getClientRect({ relativeTo: stage });
    if (node.getClassName() === "Text" && !node.rotation()) {
      const textWidth = (node as any).getTextWidth();
      const align = (node as any).align();
      const inset =
        align === "center"
          ? (rect.width - textWidth) / 2
          : align === "right"
            ? rect.width - textWidth
            : 0;
      return { ...rect, x: rect.x + inset, width: textWidth };
    }
    return rect;
  } catch {
    return null;
  }
}

function recomputeGroupBounds() {
  if (selectedElementIds.value.size <= 1) {
    groupBounds.value = null;
    return;
  }
  const rects = [...selectedElementIds.value].flatMap((id) => {
    const rect = getElementRect(id);
    return rect ? [rect] : [];
  });
  groupBounds.value = unionRect(rects);
}

watch(
  [selectedElementIds, () => template.value.elements],
  async () => {
    await nextTick();
    recomputeGroupBounds();
  },
  { deep: true, immediate: true },
);

watch(selectedElementIds, () => {
  groupRotationInput.value = 0;
});

const groupRotationDelta = computed({
  get: () => groupRotationInput.value,
  set: (deg: number) => {
    const bounds = groupBounds.value;
    if (!bounds) return;
    const delta = deg - groupRotationInput.value;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    for (const id of selectedElementIds.value) {
      const el = template.value.elements.find((e) => e.id === id);
      if (!el) continue;
      const rotated = rotateAround(el.x, el.y, cx, cy, delta);
      el.x = Math.round(rotated.x);
      el.y = Math.round(rotated.y);
      el.rotation = Math.round(((el.rotation ?? 0) + delta + 360) % 360);
    }
    groupRotationInput.value = deg;
  },
});

function applyGroupMove(newX: number, newY: number) {
  const bounds = groupBounds.value;
  if (!bounds) return;
  const dx = newX - bounds.x;
  const dy = newY - bounds.y;
  for (const id of selectedElementIds.value) {
    const el = template.value.elements.find((e) => e.id === id);
    if (!el) continue;
    el.x = Math.round(el.x + dx);
    el.y = Math.round(el.y + dy);
  }
}

const alignmentBounds = computed(() => {
  if (selectedElementIds.value.size >= 2) return groupBounds.value;
  if (selectedElementIds.value.size === 1) {
    return {
      x: 0,
      y: 0,
      width: template.value.canvasWidth,
      height: template.value.canvasHeight,
    };
  }
  return null;
});

function alignLayers(direction: AlignDirection) {
  const bounds = alignmentBounds.value;
  if (!bounds) return;
  for (const id of selectedElementIds.value) {
    const rect = getElementRect(id);
    const el = template.value.elements.find((e) => e.id === id);
    if (!rect || !el) continue;
    const { dx, dy } = alignDelta(direction, bounds, rect);
    el.x = Math.round(el.x + dx);
    el.y = Math.round(el.y + dy);
  }
}

function distributeLayers(axis: "horizontal" | "vertical") {
  const els = new Map<string, CanvasElement>();
  const items = [...selectedElementIds.value].flatMap((id) => {
    const el = template.value.elements.find((e) => e.id === id);
    const rect = getElementRect(id);
    if (!el || !rect) return [];
    els.set(id, el);
    return [{ id, rect }];
  });
  for (const [id, delta] of distributeDeltas(axis, items)) {
    const el = els.get(id)!;
    if (axis === "horizontal") el.x = Math.round(el.x + delta);
    else el.y = Math.round(el.y + delta);
  }
}

const scaleElementSize = (el: CanvasElement, sx: number, sy: number) =>
  scaleElementSizeWith(el, sx, sy, props.profile);

function applyGroupScale(newWidth: number, newHeight: number) {
  const bounds = groupBounds.value;
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
  const sx = Math.max(0.01, newWidth) / bounds.width;
  const sy = Math.max(0.01, newHeight) / bounds.height;
  const originX = bounds.x;
  const originY = bounds.y;
  for (const id of selectedElementIds.value) {
    const el = template.value.elements.find((e) => e.id === id);
    if (!el) continue;
    el.x = Math.round(originX + (el.x - originX) * sx);
    el.y = Math.round(originY + (el.y - originY) * sy);
    scaleElementSize(el, sx, sy);
  }
}

async function rebindTransformer() {
  await nextTick();
  transformerRevision.value++;
  await nextTick();
  if (transformerRef.value) {
    try {
      const tr = transformerRef.value.getNode();
      if (tr) {
        tr.nodes(transformerNodes.value);
        tr.getLayer()?.batchDraw();
      }
    } catch {
      /* ignore */
    }
  }
}

watch(selectedElementIds, () => {
  void rebindTransformer();
});

// ── Config Builders ────────────────────────────────────────────────────

/** Radius an avatar falls back to when it leaves `radius` unset. */
const avatarRadius = computed(() => props.profile.fallback.avatarRadius);

/** Avatar preview nodes only ever carried colour and blur; nothing when the profile only shadows images. */
function avatarShadowProps(el: CanvasElement) {
  if (props.profile.shadow === "image") return {};
  return { shadowColor: el.shadowColor, shadowBlur: el.shadowBlur };
}

/** Shadow props for an element, or nothing when the profile only shadows images. */
function shadowProps(el: CanvasElement) {
  if (props.profile.shadow === "image" && el.type !== "image") return {};
  return {
    shadowColor: el.shadowColor,
    shadowBlur: el.shadowBlur,
    shadowOffsetX: el.shadowOffsetX,
    shadowOffsetY: el.shadowOffsetY,
  };
}

function rectConfig(el: CanvasElement) {
  const w = el.width || 100;
  const h = el.height || 100;
  return {
    x: el.x,
    y: el.y,
    width: w,
    height: h,
    ...gradientFillProps(el.fill, 0, 0, w, h, props.profile.fallback.rectFill),
    cornerRadius: el.cornerRadius || 0,
    opacity: el.opacity ?? 1,
    ...gradientStrokeProps(el.stroke, 0, 0, w, h),
    strokeWidth: el.strokeWidth || 0,
    ...shadowProps(el),
    rotation: el.rotation || 0,
    draggable: true,
    name: el.id,
  };
}

function imageConfig(el: CanvasElement) {
  return {
    x: el.x,
    y: el.y,
    width: el.width || 100,
    height: el.height || 100,
    image: imageObjects.value[el.id],
    opacity: el.opacity ?? 1,
    rotation: el.rotation ?? 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    shadowColor: el.shadowColor,
    shadowBlur: el.shadowBlur,
    shadowOffsetX: el.shadowOffsetX,
    shadowOffsetY: el.shadowOffsetY,
    draggable: true,
    name: el.id,
  };
}

function circleConfig(el: CanvasElement) {
  const r = el.radius || 50;
  return {
    x: el.x,
    y: el.y,
    radius: r,
    ...gradientFillProps(
      el.fill,
      -r,
      -r,
      r,
      r,
      props.profile.fallback.circleFill,
    ),
    opacity: el.opacity ?? 1,
    ...gradientStrokeProps(el.stroke, -r, -r, r, r),
    strokeWidth: el.strokeWidth || 0,
    ...shadowProps(el),
    rotation: el.rotation ?? 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    draggable: true,
    name: el.id,
  };
}

function triangleConfig(el: CanvasElement) {
  const r = el.radius || 50;
  return {
    x: el.x,
    y: el.y,
    sides: 3,
    radius: r,
    ...gradientFillProps(el.fill, -r, -r, r, r, "#374151"),
    opacity: el.opacity ?? 1,
    ...gradientStrokeProps(el.stroke, -r, -r, r, r),
    strokeWidth: el.strokeWidth || 0,
    ...shadowProps(el),
    rotation: el.rotation ?? 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    draggable: true,
    name: el.id,
  };
}

function starConfig(el: CanvasElement) {
  const r = el.outerRadius || 50;
  return {
    x: el.x,
    y: el.y,
    numPoints: el.numPoints || 5,
    innerRadius: el.innerRadius || 25,
    outerRadius: r,
    ...gradientFillProps(
      el.fill,
      -r,
      -r,
      r,
      r,
      props.profile.fallback.starFill,
    ),
    opacity: el.opacity ?? 1,
    ...gradientStrokeProps(el.stroke, -r, -r, r, r),
    strokeWidth: el.strokeWidth || 0,
    ...shadowProps(el),
    rotation: el.rotation ?? 0,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    draggable: true,
    name: el.id,
  };
}

function lineConfig(el: CanvasElement) {
  return {
    x: el.x,
    y: el.y,
    points: el.points || [-60, 0, 60, 0],
    stroke: el.stroke || props.profile.fallback.lineStroke,
    strokeWidth: el.strokeWidth || 3,
    opacity: el.opacity ?? 1,
    rotation: el.rotation ?? 0,
    draggable: true,
    name: el.id,
  };
}

function textConfig(el: CanvasElement) {
  const family = el.fontFamily || "sans-serif";
  const fontSize = el.fontSize || 24;
  const width = el.width || 400;
  return {
    x: el.x,
    y: el.y,
    offsetX:
      el.align === "center" ? width / 2 : el.align === "right" ? width : 0,
    offsetY: fontSize / 2,
    width,
    text: previewText(el.text || ""),
    fontSize,
    fontFamily: family,
    fontStyle: el.fontStyle || "",
    fill: el.fill || "#ffffff",
    align: el.align || props.profile.fallback.textAlign,
    opacity: el.opacity ?? 1,
    rotation: el.rotation ?? 0,
    stroke: el.stroke,
    strokeWidth: el.strokeWidth || 0,
    ...shadowProps(el),
    draggable: true,
    name: el.id,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

const previewText = (t: string) => previewTextWith(t, props.profile);

// ── Element CRUD ───────────────────────────────────────────────────────

let elementCounter = 0;

function addElement(type: CanvasElement["type"]) {
  elementCounter++;
  const id = `${type}-${Date.now()}-${elementCounter}`;
  const cx = template.value.canvasWidth / 2,
    cy = template.value.canvasHeight / 2;

  const def = props.profile.newElement(type, cx, cy);
  if (!def) return;
  template.value.elements.push({ id, ...def } as CanvasElement);
  selectedElementIds.value = new Set([id]);
}

function insertPlaceholder(ph: string) {
  if (!selectedElement.value || selectedElement.value.type !== "text") return;
  const el = textFieldRef.value;
  const current = selectedElement.value.text || "";
  if (el) {
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    selectedElement.value.text =
      current.slice(0, start) + ph + current.slice(end);
    nextTick(() => {
      el.focus();
      const pos = start + ph.length;
      el.setSelectionRange(pos, pos);
    });
  } else {
    selectedElement.value.text = current + ph;
  }
}

function deleteSelectedElement() {
  if (selectedElementIds.value.size === 0) return;
  const deletedIds = new Set(selectedElementIds.value);
  template.value.elements = template.value.elements.filter(
    (el) => !deletedIds.has(el.id),
  );
  const nextImageObjects = { ...imageObjects.value };
  for (const id of deletedIds) {
    delete nextImageObjects[id];
    imageCache.delete(id);
  }
  imageObjects.value = nextImageObjects;
  selectedElementIds.value = new Set();
}

function duplicateSelectedElement() {
  if (selectedElementIds.value.size === 0) return;
  const imageDuplicates = [...selectedElementIds.value].filter(
    (id) =>
      template.value.elements.find((el) => el.id === id)?.type === "image",
  ).length;
  if (
    imageLayerCount(template.value.elements) + imageDuplicates >
    MAX_IMAGE_LAYERS
  ) {
    toast.add({
      title: "Image layer limit reached",
      description: `A ${props.profile.noun} can contain up to 10 images.`,
      color: "error",
    });
    return;
  }
  const newIds = new Set<string>();
  for (const id of selectedElementIds.value) {
    const src = template.value.elements.find((el) => el.id === id);
    if (!src) continue;
    elementCounter++;
    const newEl: CanvasElement = {
      ...JSON.parse(JSON.stringify(src)),
      id: `${src.type}-${Date.now()}-${elementCounter}`,
      x: src.x + 20,
      y: src.y + 20,
    };
    template.value.elements.push(newEl);
    newIds.add(newEl.id);
  }
  selectedElementIds.value = newIds;
}

function moveLayer(direction: "up" | "down") {
  if (!selectedElementId.value) return;
  const els = template.value.elements;
  const i = els.findIndex((el) => el.id === selectedElementId.value);
  if (i === -1) return;
  const target = direction === "up" ? i + 1 : i - 1;
  if (target < 0 || target >= els.length) return;
  [els[i], els[target]] = [els[target]!, els[i]!];
}

function selectElement(id: string, e?: MouseEvent) {
  if (e?.shiftKey || e?.ctrlKey || e?.metaKey) {
    const next = new Set(selectedElementIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedElementIds.value = next;
  } else {
    selectedElementIds.value = new Set([id]);
  }
}

// ── Font Change Handler ────────────────────────────────────────────────

async function handleFontChange(family: string) {
  if (!selectedElement.value) return;
  selectedElement.value.fontFamily = family;
  await loadFont(family);
  remeasureText(stageRef.value?.getNode());
  void rebindTransformer();
}

// ── Keyboard Shortcuts ─────────────────────────────────────────────────

useCanvasShortcuts({
  undo,
  redo,
  deleteSelectedElement,
  stageRef,
  isSpaceHeld,
  isShiftHeld,
  isPanning,
});

// ── Drag / Transform End Handlers ──────────────────────────────────────

function handleStageClick(e: any) {
  if (e.target === e.target.getStage()) selectedElementIds.value = new Set();
}

function handleDragStart(e: any, el: CanvasElement) {
  if (!selectedElementIds.value.has(el.id)) {
    selectedElementIds.value = new Set([el.id]);
  }
}

function moveOtherSelectedElements(
  movedEl: CanvasElement,
  newX: number,
  newY: number,
) {
  if (
    selectedElementIds.value.size <= 1 ||
    !selectedElementIds.value.has(movedEl.id)
  )
    return;
  const dx = newX - movedEl.x;
  const dy = newY - movedEl.y;
  for (const id of selectedElementIds.value) {
    if (id === movedEl.id) continue;
    const el = template.value.elements.find((e) => e.id === id);
    if (!el) continue;
    el.x = Math.round(el.x + dx);
    el.y = Math.round(el.y + dy);
  }
}

function handleDragEnd(e: any, el: CanvasElement) {
  const newX = Math.round(e.target.x());
  const newY = Math.round(e.target.y());
  moveOtherSelectedElements(el, newX, newY);
  el.x = newX;
  el.y = newY;
}

function handleLineHandleDrag(e: any, el: CanvasElement, pointIndex: number) {
  const pts = el.points ? [...el.points] : [-60, 0, 60, 0];
  pts[pointIndex] = Math.round(e.target.x() - el.x);
  pts[pointIndex + 1] = Math.round(e.target.y() - el.y);
  el.points = pts;
}

function handleTextDragEnd(e: any, el: CanvasElement) {
  const newX = Math.round(e.target.x());
  const newY = Math.round(e.target.y());
  moveOtherSelectedElements(el, newX, newY);
  el.x = newX;
  el.y = newY;
}

function handleTransformEnd(e: any, el: CanvasElement) {
  const node = e.target;
  el.x = Math.round(node.x());
  el.y = Math.round(node.y());
  el.rotation = Math.round(node.rotation());
  if (el.type === "rect" || el.type === "progressbar" || el.type === "image") {
    el.width = Math.round(Math.max(5, node.width() * node.scaleX()));
    el.height = Math.round(Math.max(5, node.height() * node.scaleY()));
    node.scaleX(1);
    node.scaleY(1);
  } else if (el.type === "avatar") {
    el.radius = Math.round(
      Math.max(5, (el.radius || avatarRadius.value) * ((node.scaleX() + node.scaleY()) / 2)),
    );
    node.scaleX(1);
    node.scaleY(1);
  } else if (el.type === "text") {
    el.width = Math.round(Math.max(20, node.width() * node.scaleX()));
    node.scaleX(1);
    node.scaleY(1);
  } else {
    el.scaleX = node.scaleX();
    el.scaleY = node.scaleY();
  }
}

function resetTemplate() {
  replaceTemplate(props.profile.defaultTemplate());
  selectedElementIds.value = new Set();
}

// ── Child Context ──────────────────────────────────────────────────────

provideCanvasEditor({
  // Props and template
  profile: toRef(props, "profile"),
  guildId: toRef(props, "guildId"),
  template,
  reversedElements,
  // Selection and hover
  selectedElementIds,
  selectedElementId,
  selectedElement,
  selectedElementOpacityPct,
  hoveredElementId,
  hoveredElementRect,
  selectElement,
  // Refs bound by child templates
  stageRef,
  transformerRef,
  canvasWrap,
  textFieldRef,
  imageUploadInput,
  // Viewport
  isSpaceHeld,
  isShiftHeld,
  isPanning,
  zoomMultiplier,
  scaleFactor,
  handlePanStart,
  handlePanMove,
  handlePanEnd,
  handleWheelZoom,
  // History
  canUndo,
  canRedo,
  undo,
  redo,
  resetTemplate,
  applyPreset,
  // Background and images
  imageObjects,
  bgImageObj,
  bgImageFile,
  bgUploading,
  replacingImageId,
  removeBgImage,
  handleImageFileSelection,
  // Element actions
  addElement,
  deleteSelectedElement,
  duplicateSelectedElement,
  moveLayer,
  insertPlaceholder,
  handleFontChange,
  alignLayers,
  distributeLayers,
  groupBounds,
  groupRotationDelta,
  applyGroupMove,
  applyGroupScale,
  // Canvas nodes and handlers
  transformerNodes,
  rectConfig,
  imageConfig,
  circleConfig,
  triangleConfig,
  starConfig,
  lineConfig,
  textConfig,
  avatarRadius,
  avatarShadowProps,
  gradientFillProps,
  handleStageClick,
  handleDragStart,
  handleDragEnd,
  handleTextDragEnd,
  handleLineHandleDrag,
  handleTransformEnd,
  // Display helpers
  elementLabel,
  elementTypeIcon,
  swatchPreview,
});

// ── Lifecycle ──────────────────────────────────────────────────────────

onMounted(async () => {
  await loadTemplateFonts(template.value.elements);
  remeasureText(stageRef.value?.getNode());
  history.reset();
});

onUnmounted(() => {
  history.dispose();
});
</script>

<style>
/* ── Foundation & Dark Glass Surface ── */
.rce {
  font-family:
    "Inter",
    system-ui,
    -apple-system,
    sans-serif;
  color: #cbd5e1;
  border-radius: 16px;
}

.rce-glass-panel {
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  border-radius: 16px;
}

/* ── Toolbar ── */
.rce-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  height: 44px;
}
.rce-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rce-toolbar-sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 2px;
}

/* ── Labels ── */
.rce-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  letter-spacing: 0.02em;
  min-width: 14px;
  text-align: right;
}
.rce-panel-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.rce-prop-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

/* ── Inputs ── */
.rce-num-input {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
  padding: 5px 8px;
  font-variant-numeric: tabular-nums;
  outline: none;
  transition: border-color 0.15s;
}
.rce-num-input:focus {
  border-color: #6366f1;
}
.rce-textarea {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
  padding: 6px 8px;
  width: 100%;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.rce-textarea:focus {
  border-color: #6366f1;
}
.rce-select {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
  padding: 5px 8px;
  outline: none;
}

/* ── Buttons ── */
.rce-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.rce-tool-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}
.rce-tool-btn-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.rce-tool-btn-sm:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}
.rce-tool-btn-sm[aria-disabled="true"] {
  opacity: 0.35;
  cursor: not-allowed;
}
.rce-tool-btn-sm[aria-disabled="true"]:hover {
  background: transparent;
  color: #64748b;
}
.rce-tool-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.15s;
  color: #cbd5e1;
}
.rce-tool-row:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: #ffffff;
}

/* ── Color Chips ── */
.rce-color-chip-lg {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s;
}
.rce-color-chip-lg:hover {
  transform: scale(1.05);
}

/* ── Layers ── */
.rce-layer {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: #94a3b8;
  background: transparent;
  border: 1px solid transparent;
  border-left-width: 3px;
  cursor: pointer;
  transition: all 0.1s;
}
.rce-layer:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}
.rce-layer-active {
  background: rgba(99, 102, 241, 0.18) !important;
  border-color: rgba(99, 102, 241, 0.4) !important;
  border-left-color: #6366f1 !important;
  color: #818cf8 !important;
  font-weight: 500;
}

/* ── Property Sections ── */
.rce-prop-section {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.rce-prop-title {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.rce-prop-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rce-placeholder-chip {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.2);
  cursor: pointer;
  transition: all 0.15s;
}
.rce-placeholder-chip:hover {
  background: rgba(99, 102, 241, 0.25);
  border-color: rgba(99, 102, 241, 0.5);
  color: #ffffff;
}

/* ── Konva Overrides ── */
.rce .konvajs-content {
  border-radius: 0 !important;
}

/* Hide number input spinners */
.rce-num-input::-webkit-inner-spin-button,
.rce-num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.rce-num-input {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* ── Preset Buttons ── */
.rce-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.15s;
  color: #94a3b8;
}
.rce-preset-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(99, 102, 241, 0.3);
  color: #e2e8f0;
}
.rce-preset-swatch {
  width: 100%;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
