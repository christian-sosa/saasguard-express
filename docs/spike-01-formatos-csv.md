# SPIKE-01 · Formatos CSV y riesgo del objetivo de 60 segundos

Fecha: 14/10/2026. Estado: **cumplido, 4 de 4 criterios**. El criterio 1 se resolvió con la documentación oficial de dos plataformas; la sección 2 explica qué significa y qué falta confirmar.

## 1. Comparación de encabezados del núcleo corporativo

Consultamos la documentación oficial de cada proveedor el 14/10/2026. Son formatos publicados por el proveedor; no son archivos descargados de una cuenta real.

| Plataforma | Origen del formato | Encabezados publicados | Email y campos obligatorios |
|---|---|---|---|
| Jira (Atlassian) | Exportación de usuarios de un sitio, desde la administración de la organización. Fuente: [Export users from a site](https://support.atlassian.com/security-and-access-policies/docs/export-users-from-a-site/) | `User ID`, `User name`, `Email`, `User status`, `Added to org`, `Org role`. Opcionales: `Group membership` (o `Group name` y `Group id` al pivotear), `Last seen in <app> - <sitio>` y `Role - <app> - <sitio>` | Email: `Email`; la lista publicada empieza con `User ID`. La ayuda no marca obligatorios, porque describe una exportación |
| Google Workspace | CSV de usuarios para altas y actualizaciones masivas. Fuente: [Agregar o actualizar varios usuarios desde un CSV](https://knowledge.workspace.google.com/admin/users/add-or-update-multiple-users-from-a-csv-file) | Obligatorios: `First Name [Required]`, `Last Name [Required]`, `Email Address [Required]`, `Password [Required]`, `Org Unit Path [Required]`. Sólo para cargar: `Password Hash Function [Upload Only]`, `New Primary Email [Upload Only]`, `New Status [Upload Only]`, `New Licenses [Upload Only]`. Otras columnas de perfil sin el texto exacto del encabezado | Email: `Email Address [Required]`; la lista publicada empieza con `First Name [Required]`. Los cinco campos de arriba son los obligatorios según Google |
| Slack | Exportación de la lista completa de miembros, para propietarios y administradores. Fuente: [Descargar una lista de miembros](https://slack.com/help/articles/4405848563603-Download-a-list-of-members-in-your-workspace) | **No confirmados.** La ayuda sólo dice que se recibe un CSV. El tablero de analíticas permite exportar miembros con campos como `Claimed date`, `Deactivated date`, `Days active` y `Last active` | Email: no confirmado |

Qué ofrece cada formato para lo que necesita el producto:

| Dato | Jira (Atlassian) | Google Workspace | Slack |
|---|---|---|---|
| Email, obligatorio para el MVP | `Email` | `Email Address [Required]` | No confirmado |
| Nombre | `User name` | `First Name [Required]` y `Last Name [Required]`, en dos columnas | No confirmado |
| Estado de la cuenta | `User status` | No publicado en la ayuda | No confirmado |
| Último acceso, para el Release 2 | `Last seen in <app> - <sitio>` | No publicado en la ayuda | `Last active` en analíticas, sólo si hubo actividad en los últimos 90 días |
| Proveedor y costo | No vienen en el archivo | No vienen en el archivo | No vienen en el archivo |

Dos conclusiones para el diseño. El único campo que el MVP necesita en todos los formatos es el email, y existe en ambos con nombres distintos y, según el orden en que cada ayuda lista los campos, no en la primera posición. Y el proveedor y el costo nunca vienen en el archivo, por eso la app los pide aparte (proveedor por defecto y costo mensual).

## 2. Decisión del 14/10 sobre el criterio 1

El criterio pide una comparación de encabezados de al menos dos exportaciones del núcleo corporativo, con su origen y sus campos obligatorios. Lo damos por cumplido con **Jira (Atlassian) y Google Workspace**, y dejamos a Slack como no confirmada. Esto es lo que significa:

- El origen de cada formato es la documentación oficial del proveedor, consultada el 14/10/2026. No son archivos exportados de una cuenta real.
- El formato de Google es el del CSV de usuarios para altas y actualizaciones. La ayuda no lista las columnas de la descarga «Descargar información de usuarios», pero el flujo de actualización indica que se edita ese archivo y se vuelve a subir, así que la estructura es la misma.
- Cumple el propósito del spike, que es elegir formatos antes de comprometer la ingesta: el MVP sólo depende del email y ese campo está confirmado en dos plataformas.
- Falta repetirlo con archivos reales de las tres plataformas. Se hace en el piloto y no bloquea el cierre de la tarjeta.

## 3. Hallazgo y corrección

Al probar la app con esos encabezados exactos apareció un problema con Google. Al cargar un archivo, la app propone una columna de email: con la exportación de Atlassian ya proponía `Email`, pero con la de Google proponía la primera columna, `First Name [Required]`, porque no reconocía `Email Address [Required]` (la etiqueta entre corchetes no es parte del nombre), y el usuario tenía que corregirla a mano.

Se corrigió sólo la propuesta de la columna de email, sin tocar el reconocimiento de las demás columnas (nombre, proveedor, plan, costo y estado). El orden de preferencia es el de antes: gana un nombre exacto de email; si no hay ninguno, se prueban los alias conocidos, con y sin etiqueta entre corchetes; si tampoco hay, se propone la primera columna. Ahora la app propone `Email` en Atlassian y `Email Address [Required]` en Google, y valida ambos archivos sin renombrar columnas.

Una revisión independiente de la primera versión de la corrección encontró dos regresiones: cambiaba la columna elegida cuando un archivo traía varias columnas de email y dejaba de reconocer encabezados de costo como `Monthly Cost [USD]`. Se reprodujeron con pruebas, se corrigieron y se volvió a correr el mismo arnés de comparación contra el código original: en un barrido de 16.839 listas de encabezados que el código original ya reconocía, ninguna cambió su columna propuesta. Hay nueve pruebas automatizadas nuevas (92 en total) y una captura en `docs/evidencia/SPIKE-01_encabezados_reales_reconocidos.jpg`.

## 4. Muestra ficticia de volumen

El script `scripts/generar-muestra-volumen.mjs` genera una muestra de 250 personas de RRHH y 1.000 filas SaaS (cuatro proveedores de 250 filas), sin datos reales.

| Dato esperado | Valor |
|---|---|
| Licencias | 1.000 |
| Coinciden con la nómina | 500 |
| Candidatas a revisión | 500 |
| Potencial mensual conocido | USD 2.253,00 |

La app produjo exactamente esos valores al cargar la muestra (captura en `docs/evidencia/SPIKE-01_HU-07_ensayo_de_volumen.jpg`; el rótulo con el tiempo se agregó a la captura y no es parte de la app). Un test automatizado (`src/domain.test.ts`, «valida y concilia correctamente 250 personas y 1000 cuentas en menos de 60 segundos») cubre además el volumen máximo.

## 5. Cómo se mide el objetivo de menos de 60 segundos

El tiempo se mide desde que el usuario hace clic en «Auditar y Cruzar Datos» hasta que el resultado completo está visible en pantalla. No incluye el tiempo humano de exportar los archivos de cada plataforma.

| Medición (14/10/2026) | Resultado |
|---|---|
| Entorno | macOS, navegador integrado de Claude (Chromium), servidor de desarrollo de Vite, muestra de 250 personas y 1.000 filas |
| Del clic al resultado visible | 297 ms en la primera corrida y 1.129 ms en una segunda; la diferencia es variación normal del navegador |
| De la carga de los archivos al resultado, con confirmación incluida | 1.481 ms, de los cuales unos 1.150 ms son esperas del propio ensayo automatizado |

La plataforma propuesta es el navegador del usuario, sin servidor. Con estos números, entre 0,3 y 1,1 segundos frente a un objetivo de 60, el objetivo no necesita ajustar el volumen ni la estrategia. Es una medición de un entorno y no un compromiso de rendimiento: falta repetirla en el equipo de un usuario real y con un archivo exportado de una plataforma.

## 6. Riesgo y pregunta pendiente

- **Riesgo.** La columna de email de Slack no está confirmada. Si trae un nombre muy distinto de los reconocidos, o varias direcciones por fila, el usuario la asigna a mano (HU-05) o el archivo no pasa la validación. Los archivos reales de las tres plataformas todavía no se probaron.
- **Pregunta pendiente para el grupo, sin bloquear la tarjeta.** ¿Quién puede descargar un CSV real, con datos de prueba, desde un espacio de Slack gratuito y desde una cuenta de Google Workspace de prueba o de los entrevistados? Con esos archivos se confirma lo documentado acá, durante el piloto.
- **No se inventó ninguna medición ni ningún encabezado.** Lo que no está confirmado figura como no confirmado.
