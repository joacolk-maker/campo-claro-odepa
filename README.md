# Campo Claro ODEPA

Sitio público para explorar precios y volúmenes mayoristas de frutas y hortalizas publicados por ODEPA.

## Arquitectura

- **Interfaz:** Next.js exportado como archivos estáticos y servido por GitHub Pages.
- **Datos públicos:** una instantánea compacta de ODEPA en `public/data/odepa-2026.json`.
- **Privacidad:** el navegador no recibe credenciales de Turso. La instantánea puede regenerarse desde el pipeline privado `odepa-data-foundation` y publicarse aquí.
- **Despliegue:** cada cambio en `main` ejecuta `.github/workflows/deploy-pages.yml` y actualiza GitHub Pages.

## Desarrollo local

```bash
pnpm install
pnpm dev
```

## Actualizar datos

Reemplaza `public/data/odepa-2026.json` por una nueva exportación validada desde ODEPA o Turso y súbela a `main`. El sitio se volverá a publicar automáticamente.

Fuente oficial: [ODEPA](https://www.odepa.gob.cl/).
