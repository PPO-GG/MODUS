<template>
  <div
    class="flex-1 flex [align-items:safe_center] [justify-content:safe_center] ce-stage overflow-auto relative"
    ref="canvasWrap"
    :class="{
      'cursor-grab': isSpaceHeld && !isPanning,
      'cursor-grabbing': isPanning,
    }"
    @wheel.prevent="handleWheelZoom"
    @mousedown="handlePanStart"
    @mousemove="handlePanMove"
    @mouseup="handlePanEnd"
    @mouseleave="handlePanEnd"
    @contextmenu="
      (e: MouseEvent) => {
        if (isSpaceHeld) e.preventDefault();
      }
    "
  >
    <!-- Checkerboard under canvas -->
    <div
      class="absolute inset-0 opacity-[0.03]"
      style="
        background-image: repeating-conic-gradient(
          #fff 0% 25%,
          transparent 0% 50%
        );
        background-size: 16px 16px;
      "
      @click="!isSpaceHeld && (selectedElementIds = new Set())"
    />

    <!-- Empty state hint -->
    <div
      v-if="template.elements.length === 0"
      class="absolute inset-0 z-20 flex flex-col items-center justify-center text-center pointer-events-none"
    >
      <UIcon
        name="i-lucide-mouse-pointer-click"
        class="text-2xl text-sky-200/60 mb-2"
      />
      <p class="text-xs text-gray-500">
        Click a tool on the left to add your first element
      </p>
    </div>

    <client-only>
      <div
        :style="{
          width: `${template.canvasWidth * scaleFactor}px`,
          height: `${template.canvasHeight * scaleFactor}px`,
        }"
        class="relative z-10 shadow-2xl shadow-black/80 ring-1 ring-white/10 rounded-xl overflow-hidden"
      >
        <v-stage
          ref="stageRef"
          :config="{
            width: template.canvasWidth * scaleFactor,
            height: template.canvasHeight * scaleFactor,
            scaleX: scaleFactor,
            scaleY: scaleFactor,
          }"
          @click="handleStageClick"
          @tap="handleStageClick"
        >
          <v-layer>
            <!-- Background Rect -->
            <v-rect
              :config="{
                x: 0,
                y: 0,
                width: template.canvasWidth,
                height: template.canvasHeight,
                fill: template.backgroundColor,
                listening: false,
              }"
            />

            <!-- Background Image -->
            <v-image
              v-if="bgImageObj"
              :config="{
                x: 0,
                y: 0,
                width: template.canvasWidth,
                height: template.canvasHeight,
                image: bgImageObj,
                listening: false,
              }"
            />

            <!-- Elements Loop -->
            <template v-for="el in template.elements" :key="el.id">
              <!-- Progress Bar -->
              <v-group
                v-if="el.type === 'progressbar'"
                :config="{
                  x: el.x,
                  y: el.y,
                  rotation: el.rotation || 0,
                  draggable: true,
                  name: el.id,
                }"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              >
                <!-- Track -->
                <v-rect
                  :config="{
                    x: 0,
                    y: 0,
                    width: el.width || 500,
                    height: el.height || 18,
                    cornerRadius: el.cornerRadius || 9,
                    fill: el.trackColor || 'rgba(255, 255, 255, 0.08)',
                    stroke: el.trackBorderColor,
                    strokeWidth: el.trackBorderWidth || 0,
                    shadowColor: el.shadowColor,
                    shadowBlur: el.shadowBlur,
                    shadowOffsetX: el.shadowOffsetX,
                    shadowOffsetY: el.shadowOffsetY,
                    opacity: el.opacity ?? 1,
                  }"
                />
                <!-- Fill (65% sample preview progress) -->
                <v-rect
                  :config="{
                    x: 0,
                    y: 0,
                    width: (el.width || 500) * 0.65,
                    height: el.height || 18,
                    cornerRadius: el.cornerRadius || 9,
                    ...gradientFillProps(
                      el.fill,
                      0,
                      0,
                      (el.width || 500) * 0.65,
                      el.height || 18,
                      '#6366f1',
                    ),
                    opacity: el.opacity ?? 1,
                  }"
                />
              </v-group>

              <!-- Rectangle -->
              <v-rect
                v-if="el.type === 'rect'"
                :config="rectConfig(el)"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              />

              <!-- Circle -->
              <v-circle
                v-if="el.type === 'circle'"
                :config="circleConfig(el)"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              />

              <!-- Triangle -->
              <v-regular-polygon
                v-if="el.type === 'triangle'"
                :config="triangleConfig(el)"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              />

              <!-- Star -->
              <v-star
                v-if="el.type === 'star'"
                :config="starConfig(el)"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              />

              <!-- Line / Arrow -->
              <template v-if="el.type === 'line'">
                <v-line
                  v-if="!el.arrow"
                  :config="lineConfig(el)"
                  @dragstart="(e: any) => handleDragStart(e, el)"
                  @dragend="(e: any) => handleDragEnd(e, el)"
                  @click="(e: any) => selectElement(el.id, e.evt)"
                  @tap="(e: any) => selectElement(el.id, e.evt)"
                />
                <v-arrow
                  v-if="el.arrow"
                  :config="lineConfig(el)"
                  @dragstart="(e: any) => handleDragStart(e, el)"
                  @dragend="(e: any) => handleDragEnd(e, el)"
                  @click="(e: any) => selectElement(el.id, e.evt)"
                  @tap="(e: any) => selectElement(el.id, e.evt)"
                />
                <!-- Interactive handles when selected -->
                <template v-if="selectedElementId === el.id">
                  <v-circle
                    :config="{
                      x: el.x + (el.points?.[0] ?? -60),
                      y: el.y + (el.points?.[1] ?? 0),
                      radius: 6,
                      fill: '#5eead4',
                      stroke: '#030712',
                      strokeWidth: 1.5,
                      draggable: true,
                    }"
                    @dragmove="(e: any) => handleLineHandleDrag(e, el, 0)"
                  />
                  <v-circle
                    :config="{
                      x: el.x + (el.points?.[2] ?? 60),
                      y: el.y + (el.points?.[3] ?? 0),
                      radius: 6,
                      fill: '#5eead4',
                      stroke: '#030712',
                      strokeWidth: 1.5,
                      draggable: true,
                    }"
                    @dragmove="(e: any) => handleLineHandleDrag(e, el, 2)"
                  />
                </template>
              </template>

              <!-- Custom Image Layer -->
              <v-image
                v-if="el.type === 'image' && imageObjects[el.id]"
                :config="imageConfig(el)"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              />

              <!-- Text -->
              <v-text
                v-if="el.type === 'text'"
                :config="textConfig(el)"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleTextDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              />

              <!-- Avatar Group -->
              <v-group
                v-if="el.type === 'avatar'"
                :config="{
                  x: el.x,
                  y: el.y,
                  rotation: el.rotation ?? 0,
                  draggable: true,
                  name: el.id,
                }"
                @dragstart="(e: any) => handleDragStart(e, el)"
                @dragend="(e: any) => handleDragEnd(e, el)"
                @click="(e: any) => selectElement(el.id, e.evt)"
                @tap="(e: any) => selectElement(el.id, e.evt)"
                @transformend="(e: any) => handleTransformEnd(e, el)"
              >
                <template v-if="el.avatarShape === 'square'">
                  <v-rect
                    v-if="el.borderWidth"
                    :config="{
                      x: -(el.radius || avatarRadius) - (el.borderWidth || 0),
                      y: -(el.radius || avatarRadius) - (el.borderWidth || 0),
                      width:
                        ((el.radius || avatarRadius) + (el.borderWidth || 0)) * 2,
                      height:
                        ((el.radius || avatarRadius) + (el.borderWidth || 0)) * 2,
                      cornerRadius: el.avatarCornerRadius ?? 0,
                      fill: el.borderColor || profile.fallback.avatarBorder,
                      opacity: el.opacity ?? 1,
                    }"
                  />
                  <v-rect
                    :config="{
                      x: -(el.radius || avatarRadius),
                      y: -(el.radius || avatarRadius),
                      width: (el.radius || avatarRadius) * 2,
                      height: (el.radius || avatarRadius) * 2,
                      cornerRadius: el.avatarCornerRadius ?? 0,
                      fill: '#4f46e5',
                      opacity: el.opacity ?? 1,
                      ...avatarShadowProps(el),
                    }"
                  />
                </template>
                <template v-else>
                  <v-circle
                    v-if="el.borderWidth"
                    :config="{
                      x: 0,
                      y: 0,
                      radius: (el.radius || avatarRadius) + (el.borderWidth || 0),
                      fill: el.borderColor || profile.fallback.avatarBorder,
                      opacity: el.opacity ?? 1,
                    }"
                  />
                  <v-circle
                    :config="{
                      x: 0,
                      y: 0,
                      radius: el.radius || avatarRadius,
                      fill: '#4f46e5',
                      opacity: el.opacity ?? 1,
                      ...avatarShadowProps(el),
                    }"
                  />
                </template>
                <v-text
                  :config="{
                    x: -(el.radius || avatarRadius),
                    y: -(el.radius || avatarRadius) / 2,
                    width: (el.radius || avatarRadius) * 2,
                    text: '👤',
                    fontSize: (el.radius || avatarRadius) * 0.8,
                    align: 'center',
                  }"
                />
              </v-group>
            </template>

            <!-- Transformer -->
            <v-transformer
              v-if="transformerNodes.length > 0"
              ref="transformerRef"
              :config="{
                nodes: transformerNodes,
                enabledAnchors:
                  selectedElement?.type === 'avatar'
                    ? [
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right',
                      ]
                    : selectedElement?.type === 'text'
                      ? ['middle-left', 'middle-right']
                      : [
                          'top-left',
                          'top-right',
                          'bottom-left',
                          'bottom-right',
                          'middle-left',
                          'middle-right',
                          'top-center',
                          'bottom-center',
                        ],
                keepRatio:
                  selectedElement?.type === 'avatar' ||
                  selectedElement?.type === 'image'
                    ? true
                    : selectedElementIds.size > 1
                      ? true
                      : selectedElement?.type !== 'circle',
                shiftBehavior:
                  selectedElement?.type === 'image'
                    ? 'inverted'
                    : 'default',
                rotateEnabled: true,
                rotationSnaps: isShiftHeld
                  ? [
                      0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165,
                      180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330,
                      345,
                    ]
                  : [],
                borderStroke: '#5eead4',
                borderStrokeWidth: 2,
                anchorStroke: '#5eead4',
                anchorStrokeWidth: 2,
                anchorFill: '#030712',
                anchorSize: 8,
                anchorCornerRadius: 2,
                rotateAnchorOffset: 20,
                padding: 2,
              }"
            />

            <!-- Hover Highlight Outline -->
            <v-rect
              v-if="hoveredElementRect"
              :config="{
                x: hoveredElementRect.x,
                y: hoveredElementRect.y,
                width: hoveredElementRect.width,
                height: hoveredElementRect.height,
                stroke: 'rgba(94, 234, 212, 0.65)',
                strokeWidth: 1.5,
                dash: [4, 4],
                listening: false,
              }"
            />
          </v-layer>
        </v-stage>
      </div>
      <template #fallback>
        <div
          class="flex items-center justify-center py-20 text-gray-500 text-sm"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="w-5 h-5 animate-spin mr-2"
          />
          Loading Canvas…
        </div>
      </template>
    </client-only>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  profile,
  template,
  selectedElementIds,
  selectedElementId,
  selectedElement,
  hoveredElementRect,
  selectElement,
  stageRef,
  transformerRef,
  canvasWrap,
  isSpaceHeld,
  isShiftHeld,
  isPanning,
  scaleFactor,
  handlePanStart,
  handlePanMove,
  handlePanEnd,
  handleWheelZoom,
  imageObjects,
  bgImageObj,
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
} = useCanvasEditorContext();
</script>
