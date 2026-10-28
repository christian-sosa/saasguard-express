# Publicación de SaaSGuard Express

Decisión del 16/10/2026: publicar el MVP académico en Vercel Hobby, con React, TypeScript y Vite. Se mantiene el procesamiento de CSV y las exportaciones en el navegador. No requiere una API, credenciales de servicios ni base de datos para su alcance actual.

Producción: [saasguard-express.vercel.app](https://saasguard-express.vercel.app/). Primer despliegue aprobado del commit `3fe26f715aba4ee22fb1d329e4a88e5566b8c704`: [detalle en Vercel](https://vercel.com/christian-sosas-projects-0c5f6ce7/saasguard-express/BtSCRz3CZLkkX7MKozqbfvMhm1Cc). Se verificó acceso HTTP sin cookies ni login y el recorrido de demo en navegador.

## Datos y alcance

Los CSV, candidatos, responsables y notas permanecen en la memoria de la pestaña y se eliminan al cerrar la auditoría, recargar o llegar a la próxima medianoche de Argentina. Los archivos originales y los reportes o snapshots descargados permanecen en el equipo. El registro agregado del piloto sigue siendo de un solo navegador y puede borrarse por separado; también vence diariamente y no es un historial compartido.

Supabase no se utiliza en esta publicación. Fábrica de Fútbol tiene usuarios reales en otro proyecto Supabase Free; SaaSGuard no cambia sus tablas, Auth, claves ni configuración. Si se incorpora una necesidad concreta de cuentas o persistencia compartida, se diseñará en un proyecto independiente gratuito si hay cupo, junto con las reglas de acceso y conservación de datos. No se deben conectar las dos aplicaciones por comodidad.

## Actualización de retención y pruebas — 16/10/2026

La regla anterior permitía hasta 24 horas de sesión. Ahora cada auditoría vence a la próxima medianoche de `America/Argentina/Buenos_Aires` (00:00 de Argentina, actualmente 03:00 UTC), manteniendo un máximo absoluto de 24 horas. Las operaciones no extienden el vencimiento. La app programa el cierre cuando está abierta y vuelve a validar la sesión al reactivar la pestaña y antes de las operaciones de carga, revisión y exportación.

Si vence mientras se preparan los archivos, limpia la carga y permanece en ese paso. La pantalla de auditoría cerrada corresponde únicamente a una auditoría que ya llegó a resultados o checklist.

Los agregados del piloto en `localStorage` se limitan al día actual de Argentina, hasta 100 registros. Leer la clave elimina registros de días anteriores, futuros o inválidos. La limpieza nocturna permanece programada después de cerrar manualmente la auditoría. Si la pestaña estaba suspendida, se limpia al volver; si el navegador estaba cerrado, los agregados vencidos se eliminan al abrir nuevamente la app. Esto funciona en el navegador y no requiere una base de datos, tarea cron, API ni credenciales en Vercel o Supabase.

Los cuatro juegos sintéticos están en [fixtures/pruebas](../fixtures/pruebas/LEEME.txt) y en la carpeta [pruebas de Drive](https://drive.google.com/drive/folders/1i1J6-JrD6jGmc6fOfWLYmAj0pHw1pOBO). Incluyen un caso pequeño, uno mediano con varios proveedores, uno de 250 personas y 1.000 licencias, y uno con errores más su versión corregida. Cada carpeta tiene instrucciones; los conteos e importes están en [expected-results.json](../fixtures/pruebas/expected-results.json). Usar sólo datos sintéticos para comprobar el dominio público.

Antes de publicar esta actualización, comprobar el límite exacto de 02:59:59.999 a 03:00:00 UTC, el cierre de una auditoría activa, la eliminación de agregados también tras un cierre manual y la limpieza al reabrir o reactivar la app. Verificar que el cambio de día UTC a las 00:00 UTC no venza una sesión del mismo día de Argentina, y que los costos desconocidos sigan distinguiéndose de cero. La simulación de medianoche en las pruebas no representa un proceso ejecutado por el servidor.

## Configuración reproducible

| Ajuste | Valor |
|---|---|
| Repositorio | `christian-sosa/saasguard-express` |
| Proyecto Vercel | `saasguard-express` |
| Preset | Vite |
| Node.js | 24.x |
| Instalación | `npm ci` |
| Build | `npm run build` |
| Directorio público | `dist/client` |
| Variables de entorno | Ninguna |
| Dominio | Subdominio gratuito `.vercel.app` |

`vercel.json` versiona el build, la salida estática, la reescritura de navegación y los encabezados. El empaquetado existente para Sites se conserva; Vercel sirve únicamente `dist/client`, sin ejecutar el worker de Sites.

La política CSP permite scripts, estilos, fuentes e imágenes locales y bloquea conexiones de la app a APIs externas (`connect-src 'none'`). También restringe la inclusión en iframes, formularios y plugins. No se incorporan analytics ni envío de nóminas. Cambiar a una API o Supabase requiere revisar expresamente esa política.

## Login con Google — 28/10/2026

Decisión del 28/10/2026 (tarjeta «Decisión · Login con Google» del Sprint 2): la app pide iniciar sesión con usuario o email y contraseña, o con «Continuar con Google». Cada cuenta tiene un rol (Administración, IT, People Operations, Finanzas o Sólo lectura) que define qué puede hacer. Los usuarios de prueba y sus permisos están en [usuarios de prueba](usuarios-de-prueba.md).

Para activar Google:

1. En Google Cloud Console, crear un cliente OAuth de tipo «Aplicación web» (no tiene costo) y agregar como orígenes de JavaScript autorizados `http://localhost:5173` y `https://saasguard-express.vercel.app`.
2. Cargar en Vercel (y en `.env.local` para desarrollo) `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_ALLOWED_EMAILS` con las cuentas admitidas y su rol (`email:rol,email:rol`). Opcional: `VITE_GOOGLE_ALLOWED_DOMAIN` para admitir con sólo lectura cualquier cuenta de un dominio de Google Workspace. Los emails reales no se suben al repositorio.
3. Volver a publicar: las variables se incorporan en el build.

Sin `VITE_GOOGLE_CLIENT_ID` no aparece el botón de Google y sólo funciona el usuario y la contraseña.

`vercel.json` permite en la CSP únicamente los recursos de `https://accounts.google.com/gsi/` y usa `Referrer-Policy: strict-origin-when-cross-origin`, que el botón de Google necesita.

Límites: no hay backend. Los usuarios de prueba viajan dentro del código como hash SHA-256 con sal, el token de Google se valida en el navegador (emisor, audiencia, vencimiento, email verificado y cuenta admitida) sin verificar su firma, y los permisos se aplican en la interfaz. El login identifica a quien opera y ordena qué puede hacer; no es una autorización de servidor ni protege datos, que siguen en el navegador. Tras cinco intentos fallidos se bloquean los intentos por 30 segundos en esa pestaña. No se piden permisos sobre Google Workspace ni se leen usuarios por API. El perfil de la sesión vive en `sessionStorage` (8 horas para usuario y contraseña, el vencimiento del token para Google) y el rol se recalcula al leerlo; «Recordar mis datos» guarda sólo el usuario en `localStorage`.

## Operación y costo

El despliegue usa Hobby para la demostración académica personal y no comercial, dentro de sus límites. No se contratan servicios pagos ni dominio. La dirección pública permite que otras personas ejecuten su propia sesión local; no permite ver la sesión de otro navegador ni otorga roles autenticados.

La integración con GitHub debe desplegar `main` y crear previews para las demás ramas. Antes de publicar código, ejecutar `npm run check`, `npm run test:sites` y `npm audit`. Verificar además en el dominio final la carga, la demo, la revisión humana, las descargas y el borrado. Un rollback del despliegue anterior no restaura las sesiones locales ya cerradas.

Los documentos académicos previos, su propuesta no-code, sus proyecciones económicas, Drive y Trello no se modifican mediante este despliegue. La disponibilidad pública de este MVP no equivale a validar un producto comercial ni a prometer un SLA.

Documentación oficial: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Hobby](https://vercel.com/docs/plans/hobby), [dominios de Vercel](https://vercel.com/docs/domains/working-with-domains).
