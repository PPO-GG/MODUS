import { ref, watch, type Ref } from "vue";
import type {
  CanvasElement,
  CanvasTemplate,
} from "~/utils/canvas-editor/types";
import type { CanvasProfile } from "~/utils/canvas-editor/profile";
import { MAX_IMAGE_LAYERS, imageLayerCount } from "~/utils/canvas-editor/elements";

type BrowserCanvasImage = HTMLImageElement | HTMLCanvasElement;
interface BrowserCanvasImageCacheEntry {
  source: string;
  renderKey: string;
  original: HTMLImageElement;
  rendered: BrowserCanvasImage;
}

/**
 * Background image and image layers: loading, SVG tinting, the per-element
 * image cache, and uploads. Selection, the stage, the transformer and the
 * shared element-id counter stay with the editor and are passed in.
 */
export function useCanvasImages(opts: {
  template: Ref<CanvasTemplate>;
  profile: Readonly<Ref<CanvasProfile>>;
  guildId: Readonly<Ref<string>>;
  toast: ReturnType<typeof useToast>;
  stageRef: Ref<any>;
  selectedElementIds: Ref<Set<string>>;
  rebindTransformer: () => Promise<void>;
  /** Advances the editor's shared element counter and returns the new value. */
  nextElementCounter: () => number;
}) {
  const {
    template,
    profile,
    guildId,
    toast,
    stageRef,
    selectedElementIds,
    rebindTransformer,
    nextElementCounter,
  } = opts;

  const bgUploading = ref(false);
  const bgImageObj = ref<HTMLImageElement | null>(null);
  const bgImageFile = ref<File | null>(null);
  const MAX_IMAGE_LAYER_SIZE = 5 * 1024 * 1024;
  const imageUploadInput = ref<HTMLInputElement | null>(null);
  const replacingImageId = ref<string | null>(null);
  const imageUploading = ref(false);

  const imageObjects = ref<Record<string, BrowserCanvasImage>>({});
  const imageCache = new Map<string, BrowserCanvasImageCacheEntry>();

  // ── Background Image ───────────────────────────────────────────────────

  function loadBgImage(url: string) {
    if (!url) {
      bgImageObj.value = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImageObj.value = img;
    };
    img.onerror = () => {
      bgImageObj.value = null;
    };
    img.src = url;
  }

  watch(
    () => template.value.backgroundImage,
    (url) => loadBgImage(url || ""),
    { immediate: true },
  );

  async function uploadBgImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) loadBgImage(dataUrl);
    };
    reader.readAsDataURL(file);

    bgUploading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("guild_id", guildId.value);
      const res = await fetch(profile.value.uploads.background, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.statusMessage || "Upload failed");
      }
      const { url } = await res.json();
      template.value.backgroundImage = url;
      toast.add({
        title: "Background uploaded",
        description: "Background image set. Remember to save.",
        color: "success",
      });
    } catch (err: any) {
      toast.add({
        title: "Upload failed",
        description: err?.message || "Could not upload image.",
        color: "error",
      });
    } finally {
      bgUploading.value = false;
      bgImageFile.value = null;
    }
  }

  watch(bgImageFile, (file) => {
    if (file) uploadBgImage(file);
  });

  function removeBgImage() {
    template.value.backgroundImage = undefined;
    bgImageObj.value = null;
  }

  // ── Element Images & Tinting ───────────────────────────────────────────

  function createTintedBrowserImage(
    image: HTMLImageElement,
    source: string,
    fill?: string,
    width?: number,
    height?: number,
  ): BrowserCanvasImage {
    if (!fill || !profile.value.images.isTintableSvg(source)) return image;

    const canvas = document.createElement("canvas");
    const size = profile.value.images.tintRasterSize(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      width || image.width,
      height || image.height,
    );
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return image;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    return canvas;
  }

  function cacheElementImage(
    el: CanvasElement,
    original: HTMLImageElement,
    renderKey: string,
  ) {
    if (!el.src) return;
    const rendered = createTintedBrowserImage(
      original,
      el.src,
      el.fill,
      el.width,
      el.height,
    );
    imageCache.set(el.id, {
      source: el.src,
      renderKey,
      original,
      rendered,
    });
    imageObjects.value = { ...imageObjects.value, [el.id]: rendered };
    stageRef.value?.getNode()?.batchDraw();
    void rebindTransformer();
  }

  function loadElementImage(el: CanvasElement) {
    if (el.type !== "image" || !el.src) return;
    const source = el.src;
    const renderKey = profile.value.images.renderKey(
      el.id,
      source,
      el.fill,
      el.width,
      el.height,
    );
    const cached = imageCache.get(el.id);
    if (cached?.renderKey === renderKey) return;
    if (cached?.source === source) {
      cacheElementImage(el, cached.original, renderKey);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const currentElement = template.value.elements.find(
        (current) => current.id === el.id,
      );
      if (
        currentElement?.type !== "image" ||
        !currentElement.src ||
        profile.value.images.renderKey(
          currentElement.id,
          currentElement.src,
          currentElement.fill,
          currentElement.width,
          currentElement.height,
        ) !== renderKey
      ) {
        return;
      }
      cacheElementImage(currentElement, image, renderKey);
    };
    image.onerror = () => {
      console.warn(`${profile.value.logPrefix} Failed to load image layer`, source);
    };
    image.src = source;
  }

  function syncElementImages(elements: CanvasElement[]) {
    const liveImageIds = new Set(
      elements.filter((el) => el.type === "image").map((el) => el.id),
    );
    const nextImageObjects = { ...imageObjects.value };
    let objectsChanged = false;

    for (const id of imageCache.keys()) {
      if (!liveImageIds.has(id)) imageCache.delete(id);
    }
    for (const id of Object.keys(nextImageObjects)) {
      if (!liveImageIds.has(id)) {
        delete nextImageObjects[id];
        objectsChanged = true;
      }
    }
    if (objectsChanged) imageObjects.value = nextImageObjects;

    elements.forEach(loadElementImage);
  }

  watch(() => template.value.elements, syncElementImages, {
    deep: true,
    immediate: true,
  });

  function loadLocalImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read image."));
      };
      image.src = objectUrl;
    });
  }

  function handleImageFileSelection(event: Event) {
    const replaceId = replacingImageId.value;
    replacingImageId.value = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const replaceElement = replaceId
      ? template.value.elements.find((el) => el.id === replaceId)
      : undefined;

    if (replaceElement?.type === "image") {
      void uploadImageLayer(file, replaceElement);
    } else {
      void uploadImageLayer(file);
    }
  }

  async function uploadImageLayer(
    file: File,
    replaceElement?: CanvasElement,
  ): Promise<void> {
    if (file.size > MAX_IMAGE_LAYER_SIZE) {
      toast.add({
        title: "Image too large",
        description: "Choose an image no larger than 5 MB.",
        color: "error",
      });
      return;
    }
    if (
      !replaceElement &&
      imageLayerCount(template.value.elements) >= MAX_IMAGE_LAYERS
    ) {
      toast.add({
        title: "Image layer limit reached",
        description: `A ${profile.value.noun} can contain up to 10 images.`,
        color: "error",
      });
      return;
    }
    if (imageUploading.value) return;

    imageUploading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("guild_id", guildId.value);
      const uploadPromise = fetch(profile.value.uploads.image, {
        method: "POST",
        body: formData,
      });
      const localImagePromise = loadLocalImage(file);
      const response = await uploadPromise;
      if (!response.ok) {
        void localImagePromise.catch(() => undefined);
        const error = await response.json().catch(() => ({}));
        throw new Error(error.statusMessage || "Could not upload image layer.");
      }

      const { url } = (await response.json()) as { url: string };
      const localImage = await localImagePromise;
      const naturalWidth = localImage.naturalWidth;
      const naturalHeight = localImage.naturalHeight;
      if (!naturalWidth || !naturalHeight) {
        throw new Error("Could not read image.");
      }
      const scale = Math.min(1, 200 / naturalWidth, 200 / naturalHeight);
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));

      if (replaceElement) {
        replaceElement.src = url;
        replaceElement.width = width;
        replaceElement.height = height;
        const nextImageObjects = { ...imageObjects.value };
        delete nextImageObjects[replaceElement.id];
        imageObjects.value = nextImageObjects;
        imageCache.delete(replaceElement.id);
        loadElementImage(replaceElement);
        toast.add({
          title: "Image layer replaced",
          description: "Remember to save your changes.",
          color: "success",
        });
        return;
      }

      const element: CanvasElement = {
        id: `image-${Date.now()}-${nextElementCounter()}`,
        type: "image",
        x: Math.round((template.value.canvasWidth - width) / 2),
        y: Math.round((template.value.canvasHeight - height) / 2),
        width,
        height,
        src: url,
        opacity: 1,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      template.value.elements.push(element);
      selectedElementIds.value = new Set([element.id]);
      loadElementImage(element);
      toast.add({
        title: "Image layer added",
        description: "Remember to save your changes.",
        color: "success",
      });
    } catch (err: any) {
      toast.add({
        title: "Upload failed",
        description: err?.message || "Could not upload image layer.",
        color: "error",
      });
    } finally {
      imageUploading.value = false;
    }
  }

  return {
    imageObjects,
    imageCache,
    bgImageObj,
    bgImageFile,
    bgUploading,
    imageUploading,
    imageUploadInput,
    replacingImageId,
    uploadBgImage,
    removeBgImage,
    loadElementImage,
    syncElementImages,
    handleImageFileSelection,
    uploadImageLayer,
  };
}
