What I changed
--------------

- Added a minimal `tsconfig.json` earlier to satisfy CLI checks.
- Added a path mapping in `tsconfig.json` so `@/*` resolves to `src/*`.
- Added a simple `Button` component at `src/components/Button.jsx` because the
  `npx untitledui add button` command did not complete interactively in this
  environment.

How to use
----------

You can import the component using the alias you selected during the CLI
interaction:

```js
import Button from '@/components/Button'
```

Notes
-----
- If you prefer the exact scaffolding the CLI would create (styles, stories,
  variants), run the CLI locally and answer the prompts. The CLI may add more
  files and Tailwind configuration.
