# Local Fonts

ARKA self-hosts these font files so production builds do not depend on Google Fonts network access.

Active fonts loaded from `src/app/layout.tsx`:

- `inter-latin-400.ttf`, `inter-latin-500.ttf`, `inter-latin-600.ttf`, `inter-latin-700.ttf`
- `outfit-latin-400.ttf`, `outfit-latin-500.ttf`, `outfit-latin-600.ttf`, `outfit-latin-700.ttf`

The old `inter-latin-variable.woff2` and `outfit-latin-variable.woff2` files are retained only for traceability. Metadata audit showed they are static Black weights (`usWeightClass: 900`) and do not contain an `fvar` table, so they must not be used as variable fonts.

Both font families are distributed through Google Fonts under the SIL Open Font License.
