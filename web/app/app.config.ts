export default defineAppConfig({
  ui: {
    colors: {
      primary: "teal",
      secondary: "sky",
      success: "emerald",
      info: "sky",
      warning: "amber",
      error: "red",
      neutral: "gray",
    },
    button: {
      slots: { base: "rounded-full" },
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class:
            "bg-sky-200/10 text-sky-200 ring ring-inset ring-sky-100/20 hover:bg-sky-200/15 hover:text-teal-300 hover:ring-teal-200/40 active:bg-sky-200/20 disabled:bg-sky-200/10 aria-disabled:bg-sky-200/10 focus-visible:outline-teal-300",
        },
        {
          color: "primary",
          variant: "soft",
          class:
            "bg-sky-200/5 text-sky-200 hover:bg-sky-200/10 hover:text-teal-300 focus-visible:ring-teal-300",
        },
      ],
    },
    badge: {
      slots: { base: "rounded-full" },
    },
    card: {
      slots: { root: "rounded-xl backdrop-blur-md" },
      variants: {
        variant: {
          outline: {
            root: "bg-white/[0.03] ring ring-white/10 divide-y divide-white/5",
          },
          subtle: {
            root: "bg-white/[0.04] ring ring-white/10 divide-y divide-white/5",
          },
        },
      },
    },
    modal: {
      slots: {
        content: "glide-grain ring ring-white/15 divide-white/5",
      },
    },
  },
});
