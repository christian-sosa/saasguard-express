# Planning del Sprint 4

**Sprint:** del viernes 13/11 al jueves 19/11/2026, una semana. **Congelamiento del código:** miércoles 18/11; lo que no esté revisado ese día queda para después del pitch (acción 3 de la retrospectiva del Sprint 3).

**Objetivo del sprint:** llegar al pitch con el MVP publicado estable, probado por al menos una persona real de cada perfil, y con la administración de usuarios funcionando o presentada como pendiente, sin código a medio hacer en `main`.

## Qué pidió el docente

En la clase del 12/11 el docente marcó dos cosas para este sprint:

- «aprovechen el Sprint 3 y cuatro para enfocarse en funcionalidades que trabajen correctamente y no tener muchas funcionalidades que no trabajan» [38:34].
- «el MVP y el proyecto en sí es muy sólido, no falta revalidarlo con usuarios reales» [53:00].

Por eso la historia nueva entra con una condición: se programa sólo si su dependencia está lista el lunes 16/11. Si no lo está, pasa a la sección «Qué haríamos con más sprints» del documento final y del pitch.

## Backlog del sprint

Los responsables son una propuesta y se confirman en la primera daily.

| Orden | Ítem | Origen | SP | Responsable | Terminado cuando |
|---|---|---|---|---|---|
| 1 | Sesiones con usuarios de los tres perfiles | Arrastre del Sprint 1, acción 1 de la retro del Sprint 3 | — | Marcelo Mansilla coordina; un perfil por integrante | Tres sesiones hechas con el [kit del Sprint 3](sesion-usuarios-sprint3.md) y registradas antes del 19/11 |
| 2 | Ingreso con Google en producción | Arrastre del Sprint 3 | — | Christian Sosa | Cliente OAuth creado y una cuenta admitida y otra rechazada probadas en el dominio, o anotado como pendiente en el pitch |
| 3 | Verificación de EN-02 por persona | Arrastre del Sprint 3 | — | Pedro Juliano | Cada criterio de la [matriz](en-02-matriz-verificacion.md) con quién lo verificó y la fecha |
| 4 | Decisión del PO sobre la búsqueda de alias | Arrastre del Sprint 3 | — | PO | La búsqueda queda aceptada con sus criterios o se quita antes del congelamiento |
| 5 | **HU-19 · Administrar usuarios y roles** | Nueva, pedida el 13/11 | 8 | A confirmar | Ver la historia y su condición de entrada |
| 6 | PR obligatorio y protección de `main` | Acción 2 de la retro del Sprint 3 | — | Christian Sosa | Ningún commit directo a `main` entre el 13/11 y el 19/11 |

**Capacidad.** Los arrastres ya se estimaron en sprints anteriores y no suman puntos nuevos. En el Sprint 2 planificamos 24 SP para dos semanas y cerramos 21, porque EN-02 quedó en curso. En una semana calculamos un techo de unos 12 SP, y las sesiones con usuarios se llevan buena parte del tiempo del equipo aunque no tengan puntos. La HU-19 es lo primero que sale si el sprint se complica.

## HU-19 · Administrar usuarios y roles

> Como administrador de SaaSGuard, quiero ver y gestionar desde una pantalla quién puede entrar y con qué rol, para dar acceso al equipo sin pedirle a un desarrollador que cambie la configuración del servidor.

**Punto de partida.** El ingreso con usuario y contraseña o con Google y los cinco roles (`admin`, `it`, `people`, `finance` y `viewer`) ya están en `main`. Las cuentas salen de variables de entorno (`SAASGUARD_PASSWORD_USERS` y `SAASGUARD_GOOGLE_ALLOWED_EMAILS`) y cada cambio exige editar esas variables y volver a desplegar. Lo que agrega esta historia es la pantalla y el lugar donde guardar los cambios.

**Estimación.** 8 SP. El login con roles se estimó en 5 (dos métodos, cinco roles y permisos en cada acción). Esta historia suma almacenamiento en el servidor, alta, cambio de rol y baja, el registro de cambios y la regla del último administrador.

**Numeración.** HU-18 ya se usa en el README para el registro del piloto, así que la historia nueva toma el número 19.

### Criterios de aceptación

1. Sólo el rol `admin` ve la opción «Usuarios». Si otro rol llama a la API de administración, el servidor responde 403, aunque la llamada no salga de la pantalla.
2. La pantalla lista cada cuenta con nombre, email, usuario, rol, método de ingreso (contraseña, Google o ambos) y estado (activa o desactivada).
3. El administrador puede crear una cuenta con contraseña: nombre, email, usuario, rol y una contraseña inicial de al menos 12 caracteres. La contraseña se guarda con `scrypt` y un salt por cuenta, como hoy, y nunca vuelve al navegador.
4. El administrador puede habilitar un email de Google con un rol.
5. El administrador puede cambiar el rol de una cuenta y desactivarla. El cambio rige desde la siguiente solicitud de esa persona, sin esperar a que venza su sesión.
6. No se puede desactivar ni quitarle el rol al último administrador activo.
7. Cada cambio queda registrado con quién lo hizo, qué cambió y cuándo, sin contraseñas ni hashes.
8. Si el almacenamiento no está configurado, la pantalla muestra las cuentas de las variables de entorno en sólo lectura y explica qué falta. El ingreso sigue funcionando como hoy.

### Diseño propuesto

- **Almacenamiento.** Las funciones de Vercel no tienen disco persistente y las variables de entorno no se pueden escribir mientras la app corre. Hace falta una base de datos del Marketplace de Vercel, en un proyecto propio de SaaSGuard, como ya anticipa la [guía de despliegue](despliegue.md). Sus credenciales viven sólo en las variables de entorno de Vercel.
- **Servidor.** Un adaptador de cuentas con dos implementaciones: la actual, de sólo lectura sobre las variables de entorno, y la persistente. Las cuentas de las variables siguen funcionando y aseguran que siempre haya un administrador para entrar. `readSession` ya vuelve a validar la cuenta en cada solicitud, así que el cambio de rol y la baja rigen enseguida si esa validación pasa a leer el adaptador.
- **API.** `/api/admin/users` con `GET` para listar, `POST` para crear y `PATCH` para cambiar rol, estado o contraseña. Reutiliza la sesión firmada, el control de origen, el límite de tamaño del cuerpo y las validaciones de `server/auth-server.js`.
- **Pantalla.** Un permiso nuevo, `manageUsers`, sólo para `admin` en `src/roles.ts`, y una sección «Usuarios» con la tabla, el alta y la edición en línea.

### Tareas

| ID | Tarea | Depende de |
|---|---|---|
| T1 | Elegir y crear la base de datos en Vercel y cargar sus variables | Cuenta de Vercel del proyecto |
| T2 | Adaptador de cuentas con pruebas para los dos modos | T1 para el modo persistente |
| T3 | API de administración con pruebas: 403 para cada rol que no es admin, origen, validaciones y último administrador | T2 |
| T4 | Pantalla «Usuarios» y permiso `manageUsers` | T3 |
| T5 | Registro de cambios | T3 |
| T6 | Prueba en el dominio con los cinco roles y captura de la evidencia | T4 y T5 |
| T7 | Actualizar `despliegue.md` y `usuarios-de-prueba.md` | T6 |

### Condición de entrada y plan B

- **Entra al sprint** si el lunes 16/11 la base de datos existe y sus variables están cargadas en Vercel (T1). Desde ahí quedan dos días hábiles hasta el congelamiento.
- **Si no entra**, queda en el backlog como Could y se cuenta en «Qué haríamos con más sprints». No se mergea nada parcial a `main`.
- **Si entra pero no llega al 18/11**, la rama queda abierta y la historia se presenta como en curso. No se publica una pantalla que no cumple los criterios 1, 3 y 6.

### Riesgos

- **Seguridad.** Es la primera vez que la app escribe cuentas desde el navegador. Un error en el control de rol le da acceso de administrador a cualquiera. El PR necesita la revisión de otro integrante antes de entrar a `main`.
- **Tiempo.** La historia compite con las sesiones con usuarios, que el docente marcó como lo central del sprint.
- **Datos personales.** La base guarda nombres y emails del equipo. No se cargan cuentas de terceros ni datos de auditoría.

## Fuera de este sprint

La comparación entre auditorías (HU-17) con datos reales, la métrica del piloto, la conexión por API con los proveedores y, si no entra, la HU-19 van a la sección «Qué haríamos con más sprints» del documento final y del pitch.
