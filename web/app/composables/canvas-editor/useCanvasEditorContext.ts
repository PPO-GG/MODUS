import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from "vue";
import type { CanvasProfile } from "~/utils/canvas-editor/profile";
import type { CanvasElement, CanvasTemplate } from "~/utils/canvas-editor/types";

/**
 * Everything the canvas editor's child components read: the template, selection
 * state, refs and actions that CanvasEditor.vue assembles from its composables.
 * Reactive members are Refs/computeds so a child's destructured bindings stay
 * reactive (templates auto-unwrap them). Typed loosely to avoid restating ~80
 * members, except those whose template callbacks and v-for indices need types.
 */
export interface CanvasEditorContext {
  profile: Ref<CanvasProfile>;
  template: ComputedRef<CanvasTemplate>;
  reversedElements: ComputedRef<CanvasElement[]>;
  [key: string]: any;
}

const KEY: InjectionKey<CanvasEditorContext> = Symbol("canvas-editor");

export const provideCanvasEditor = (ctx: CanvasEditorContext) => provide(KEY, ctx);

export function useCanvasEditorContext(): CanvasEditorContext {
  const ctx = inject(KEY);
  if (!ctx) throw new Error("useCanvasEditorContext must be used inside <CanvasEditor>");
  return ctx;
}
