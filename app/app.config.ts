// Maps the v2 palette onto Nuxt UI's semantic slots, so a plain `UButton` or
// `UAlert` is already the design's colour without a per-component override.
//
// The slot overrides below are the design's structural habits — mono uppercase
// field labels, generous radii, tight display type on dialog titles — applied
// once here rather than retyped on every field in every form.
//
// These merge into each slot's *base* classes and win there (tailwind-merge
// resolves the conflict in favour of the later value). What they cannot beat
// is a class Nuxt UI appends from a size or variant slot afterwards — its 1px
// `ring` on inputs, for one. Override those per instance with the `ui` prop.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'amber',
      neutral: 'sand'
    },
    formField: {
      slots: {
        label: 'sb-mono text-(--sb-muted)'
      }
    },
    input: {
      slots: { base: 'rounded-xl' }
    },
    textarea: {
      slots: { base: 'rounded-xl' }
    },
    select: {
      slots: { base: 'rounded-xl' }
    },
    inputMenu: {
      slots: { base: 'rounded-xl' }
    },
    button: {
      slots: {
        base: 'rounded-xl font-bold'
      }
    },
    alert: {
      slots: {
        root: 'rounded-2xl'
      }
    },
    // A dialog is a card like any other in this app: same big radius, same
    // tight display type on its title.
    modal: {
      slots: {
        // Important, unusually: Nuxt UI sets the dialog's radius from a slot
        // appended after this one, so a plain `rounded-*` here is merged away
        // and the mobile dialog keeps its 8px corners.
        content: 'rounded-[1.75rem]!',
        title: 'sb-display text-xl',
        footer: 'gap-2'
      }
    },
    slideover: {
      slots: {
        title: 'sb-display text-xl'
      }
    }
  }
})
