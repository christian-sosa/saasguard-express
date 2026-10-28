# Usuarios de prueba

Cuentas ficticias para probar el login y los permisos por rol. Se puede ingresar con el usuario o con el email. **No son credenciales reales**: viajan dentro del código de la app (como hash SHA-256 con sal) porque el MVP no tiene backend, así que cualquiera que inspeccione el sitio podría extraerlas. No usarlas para datos reales.

| Usuario | Email | Contraseña | Rol | Qué puede hacer |
|---|---|---|---|---|
| `admin` | `admin@saasguard.test` | `SG-admin-767f7f` | admin | Todo: carga, revisión, costos, Excel, PDF y registro del piloto |
| `ignacio.it` | `ignacio.it@empresa.test` | `SG-it-755531` | it | Carga archivos, confirma casos al checklist, anota excepciones y descarga Excel |
| `florencia.rrhh` | `florencia.rrhh@empresa.test` | `SG-people-5568a2` | people | Carga archivos y anota casos para RRHH o excepciones; no confirma bajas ni exporta |
| `gonzalo.finanzas` | `gonzalo.finanzas@empresa.test` | `SG-finance-eed82b` | finance | Carga archivos, corrige costos, confirma casos y descarga Excel y PDF |
| `lector` | `lector@empresa.test` | `SG-viewer-57c530` | viewer | Sólo la demo con datos ficticios, sin cambios ni descargas |

Todas las cuentas pueden ver resultados, buscar, filtrar, descargar el snapshot y cerrar su propia auditoría, porque borrar los datos cargados no puede depender del rol.

## Ingreso con Google

Además del usuario y la contraseña, el botón «Continuar con Google» admite las cuentas listadas en `VITE_GOOGLE_ALLOWED_EMAILS` (formato `email:rol,email:rol`) y, si se configura `VITE_GOOGLE_ALLOWED_DOMAIN`, cualquier cuenta de ese dominio con rol de sólo lectura. Los emails reales van en las variables de entorno (`.env.local` o Vercel), no en el repositorio. Ver [despliegue](despliegue.md#login-con-google--28102026).
