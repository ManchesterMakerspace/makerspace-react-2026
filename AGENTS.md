# Coding agent instructions

## User-interface standard

- Read and follow `docs/user-experience.MD` before creating or changing any
  user-visible UI, styling, layout, typography, colors, icons, imagery,
  interaction feedback, or responsive behavior.
- Treat `docs/user-experience.MD` as the repository's authoritative UX and
  visual-design standard. Reuse the established MUI theme and patterns rather
  than introducing a parallel design system.
- Check UI changes at the responsive widths and against the accessibility
  checklist specified in that document.
- If a task intentionally changes a shared UX convention, update
  `docs/user-experience.MD` in the same change so the documentation and
  implementation remain aligned.
- Do not silently depart from the standard. When a product requirement makes an
  exception necessary, keep the exception narrowly scoped and document the
  reason in code or in `docs/user-experience.MD`, as appropriate.
