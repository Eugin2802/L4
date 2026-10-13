# L4 — Laureles 4

Mercado privado para residentes del condominio Laureles 4. Incluye catálogo, cuentas con Clerk, perfiles de vendedores, pedidos, favoritos, reseñas, reportes de moderación, destacados y un panel de administración.

## Paquete de código

Este archivo reúne el código fuente de la web, el servidor API, los contratos API, los clientes generados y el esquema de base de datos. No incluye claves, contraseñas, datos de usuarios ni `node_modules`.

## Ejecutarlo

Se requiere Node.js, pnpm y PostgreSQL. Desde la raíz del proyecto:

1. Instala dependencias: `pnpm install`
2. Configura las variables de entorno indicadas abajo.
3. Aplica el esquema: `pnpm --filter @workspace/db run push`
4. Inicia el API: `pnpm --filter @workspace/api-server run dev`
5. En otra terminal, inicia la web: `pnpm --filter @workspace/l4-condominio run dev`

## Variables necesarias

- `DATABASE_URL`: conexión a PostgreSQL.
- `SESSION_SECRET`: secreto aleatorio para firmar la sesión de administración.
- `L4_ADMIN_PASSWORD`: clave privada para el panel de administración.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` y `VITE_CLERK_PUBLISHABLE_KEY`: autenticación con Clerk.
- `L4_SPREADSHEET_ID`: ID de la hoja de registros de residentes.
- `VITE_CLERK_PROXY_URL`: solo si la instalación de Clerk requiere una URL de proxy.

Configura estos valores en un gestor de secretos; nunca los subas al repositorio.

## Límites actuales

- Las fotos de perfil y de productos muestran una vista previa, pero todavía no se guardan de forma persistente. Los comprobantes se envían directamente por WhatsApp al contacto correspondiente y no se almacenan en L4.
- El registro en Google Sheets usa el conector de Google de Replit. Para ejecutar este código fuera de Replit, hay que reemplazar ese adaptador por credenciales y acceso propios de Google Sheets.
- Los reportes, pedidos y solicitudes se actualizan dentro de la aplicación mientras la pantalla correspondiente está abierta; este paquete no configura avisos por correo ni notificaciones push.
- El reporte de ventas se descarga como CSV compatible con Excel.
