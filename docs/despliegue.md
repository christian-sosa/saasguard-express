# Publicación de SaaSGuard Express

Decisión del 16/10/2026: publicar el MVP académico en Vercel Hobby, con React, TypeScript y Vite. Se mantiene el procesamiento de CSV y las exportaciones en el navegador. No requiere una API, credenciales de servicios ni base de datos para su alcance actual.

## Datos y alcance

Los CSV, candidatos, responsables y notas permanecen en la memoria de la pestaña y se eliminan al cerrar la auditoría, recargar o vencer la sesión de 24 horas. Los archivos descargados permanecen en el equipo. El registro agregado del piloto sigue siendo local a un navegador y puede borrarse por separado; no es un historial compartido.

Supabase no se utiliza en esta publicación. Fábrica de Fútbol tiene usuarios reales en otro proyecto Supabase Free; SaaSGuard no cambia sus tablas, Auth, claves ni configuración. Si se incorpora una necesidad concreta de cuentas o persistencia compartida, se diseñará en un proyecto independiente gratuito si hay cupo, junto con las reglas de acceso y conservación de datos. No se deben conectar las dos aplicaciones por comodidad.

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

## Operación y costo

El despliegue usa Hobby para la demostración académica personal y no comercial, dentro de sus límites. No se contratan servicios pagos ni dominio. La dirección pública permite que otras personas ejecuten su propia sesión local; no permite ver la sesión de otro navegador ni otorga roles autenticados.

La integración con GitHub debe desplegar `main` y crear previews para las demás ramas. Antes de publicar código, ejecutar `npm run check`, `npm run test:sites` y `npm audit`. Verificar además en el dominio final la carga, la demo, la revisión humana, las descargas y el borrado. Un rollback del despliegue anterior no restaura las sesiones locales ya cerradas.

Los documentos académicos previos, su propuesta no-code, sus proyecciones económicas, Drive y Trello no se modifican mediante este despliegue. La disponibilidad pública de este MVP no equivale a validar un producto comercial ni a prometer un SLA.

Documentación oficial: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Hobby](https://vercel.com/docs/plans/hobby), [dominios de Vercel](https://vercel.com/docs/domains/working-with-domains).
