# Publicación de SaaSGuard Express

El MVP académico usa Vercel Hobby, React, TypeScript y Vite. La aplicación procesa los CSV y genera las exportaciones en el navegador. La función `/api/auth` verifica el acceso y administra la sesión. Los datos de auditoría permanecen en el navegador de cada usuario.

El dominio de producción es [saasguard-express.vercel.app](https://saasguard-express.vercel.app/). El 16/10/2026 se verificaron el acceso HTTP y el recorrido de la demo de la primera versión publicada, que era de acceso abierto. [Despliegue del commit `3fe26f7`](https://vercel.com/christian-sosas-projects-0c5f6ce7/saasguard-express/BtSCRz3CZLkkX7MKozqbfvMhm1Cc)

## Datos y alcance

Los CSV, candidatos, responsables y notas permanecen en la memoria de la pestaña y se eliminan al cerrar la auditoría, recargar o llegar a la próxima medianoche de Argentina. Los archivos originales y los reportes o snapshots descargados permanecen en el equipo. El registro agregado del piloto sigue siendo de un solo navegador y puede borrarse por separado; también vence diariamente y no es un historial compartido.

El MVP funciona con almacenamiento local para la auditoría y variables de entorno para las cuentas. Si se incorpora persistencia compartida, se diseñará en un proyecto independiente del de Fábrica de Fútbol, con reglas propias de acceso y conservación de datos.

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
| Build | `SAASGUARD_SERVER_AUTH=1 npm run build` |
| Directorio público | `dist/client` |
| Autenticación | Función `/api/auth`, con configuración de servidor |
| Variables de entorno | `SAASGUARD_SESSION_SECRET`, `SAASGUARD_PASSWORD_USERS` para las cuentas con contraseña y las variables opcionales de Google descritas abajo |
| Dominio | Subdominio gratuito `.vercel.app` |

`vercel.json` versiona el build, la salida estática, las rutas y los encabezados. Vercel sirve `dist/client` y ejecuta `api/auth.js` como función. El build de Vercel siempre selecciona el modo de servidor. La pantalla indica que el ingreso no está disponible si falta una clave de sesión válida. El empaquetado para Sites tiene su propio worker.

La política CSP permite que la aplicación se conecte a `/api/auth` en el mismo origen y permite los recursos de Google Identity Services (`https://accounts.google.com/gsi/`) para el botón opcional. Los datos de auditoría se procesan localmente.

## Configurar el acceso

En Vercel, cargá estas variables de servidor para el entorno que vayas a publicar. Para probar la misma función con `npm run dev`, usá `.env.local` con valores de prueba. [Variables de ejemplo](../.env.example)

- `SAASGUARD_SESSION_SECRET` contiene 32 bytes aleatorios en hexadecimal (64 dígitos). Podés generarlos con `crypto.randomBytes(32)` de Node.js.
- `SAASGUARD_PASSWORD_USERS` contiene un arreglo JSON. Cada cuenta tiene `username`, `email`, `name`, `role`, `salt` y `hash`. Generá un `salt` aleatorio por cuenta, calculá el hash con `scrypt(contraseña, salt, 64)` usando los bytes del salt y guardá `salt` y `hash` en hexadecimal. Los roles disponibles son `admin`, `it`, `people`, `finance` y `viewer`. Usá `[]` si la publicación se configura exclusivamente con Google.

Guardá los valores de producción en Vercel y los de desarrollo en `.env.local`. El servidor verifica las credenciales y devuelve el rol con una sesión firmada. La cookie usa `HttpOnly`, `SameSite=Lax` y `Secure` en Vercel. La sesión con contraseña dura hasta ocho horas. Con Google vence cuando vence el token o a las ocho horas, lo que ocurra primero. «Recordar mis datos» conserva sólo el identificador en el navegador.

La interfaz usa el rol para decidir qué acciones mostrar en la auditoría local. La API gestiona exclusivamente la autenticación. Los archivos y resultados quedan en la pestaña de quien los cargó.

### Activar Google

1. En Google Cloud Console, creá un cliente OAuth de tipo «Aplicación web». Agregá `https://saasguard-express.vercel.app` como origen de JavaScript autorizado y el origen local que uses para desarrollo, por ejemplo `http://localhost:5173`.
2. Configurá `SAASGUARD_GOOGLE_CLIENT_ID` y una lista de cuentas con `SAASGUARD_GOOGLE_ALLOWED_EMAILS` en formato `email:rol,email:rol`. También podés configurar `SAASGUARD_GOOGLE_ALLOWED_DOMAIN` para asignar el rol `viewer` a las cuentas verificadas de ese dominio de Google Workspace. Si una cuenta tiene un rol explícito en la lista, ese rol tiene prioridad.
3. Volvé a desplegar y verificá el acceso con una cuenta admitida y otra sin acceso. El servidor valida la firma, audiencia y vigencia del token de Google, el email verificado y la regla de acceso. El botón aparece cuando el servidor tiene el cliente y una lista o dominio autorizado. Con cuentas de contraseña aprovisionadas, podés publicar con ese método mientras Google queda pendiente de configuración.

En `npm run dev` sin `SAASGUARD_SESSION_SECRET` se usan las cuentas sintéticas de [la demo local](usuarios-de-prueba.md). Las variables `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_ALLOWED_EMAILS` y `VITE_GOOGLE_ALLOWED_DOMAIN` sirven para ensayos locales de esa demo. Vite las expone al navegador. Usá únicamente valores ficticios en ellas y reservá las variables `SAASGUARD_*` para la configuración de servidor.

## Publicación del Sprint 3

Para publicar el incremento:

1. Integrar los cambios aceptados y comprobar que `npm run check`, `npm run test:sites` y `npm audit` terminen bien.
2. Cargar la clave de sesión y las cuentas de contraseña. Cargar el cliente de Google y sus reglas de acceso si se va a habilitar ese método.
3. Comprobar que la verificación de GitHub y el despliegue de Vercel terminen bien para el commit de `main`.
4. Sobre la versión mergeada, correr `node docs/evidencia/sprint3/en02-ensayo.cjs` y anotar el resultado en [la matriz EN-02](en-02-matriz-verificacion.md).
5. En la URL pública, comprobar a mano:
   - [ ] Se entra con las cuentas aprovisionadas y cada rol ve las acciones que le corresponden.
   - [ ] La sesión se conserva al recargar y se elimina al cerrar sesión.
   - [ ] El juego `02_mediano_multiplataforma` da 90 cuentas, 60 coincidencias y 30 candidatas.
   - [ ] Excel y PDF se descargan con la selección.
   - [ ] Una cuenta de Google admitida entra y una no admitida recibe el mensaje de acceso. Si no se configuró Google, anotar que no se probó.
   - [ ] La consola no muestra errores de CSP.
   - [ ] Cerrar la auditoría y recargar deja la app sin datos.
6. Registrar la fecha y el commit publicado en [`resultado-validacion.md`](resultado-validacion.md).

## Operación y costo

El despliegue usa Hobby y el subdominio gratuito de Vercel para la demostración académica personal y no comercial. Cada cuenta admitida ejecuta su auditoría en su propio navegador.

La integración con GitHub debe desplegar `main` y crear previews para las demás ramas. Antes de publicar código, ejecutar `npm run check`, `npm run test:sites` y `npm audit`. Verificar además en el dominio final la carga, la demo, la revisión humana, las descargas y el borrado. Un rollback del despliegue anterior no restaura las sesiones locales ya cerradas.

Los documentos académicos previos, su propuesta no-code, sus proyecciones económicas, Drive y Trello no se modifican mediante este despliegue. La disponibilidad pública de este MVP no equivale a validar un producto comercial ni a prometer un SLA.

Documentación oficial: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Hobby](https://vercel.com/docs/plans/hobby), [dominios de Vercel](https://vercel.com/docs/domains/working-with-domains).
