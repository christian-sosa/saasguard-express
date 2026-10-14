# SPIKE-01 · Formatos CSV y riesgo del objetivo de 60 segundos

Fecha: 14/10/2026. Estado: **parcial**. El criterio 1 (comparar encabezados de al menos dos exportaciones) queda abierto porque no pudimos confirmar los encabezados de Google Workspace ni de Slack. Los otros tres criterios están documentados y verificados.

## 1. Formatos de exportación del núcleo corporativo

Consultamos la ayuda oficial de cada proveedor el 14/10/2026. Sólo uno publica los encabezados exactos.

| Plataforma | Cómo se exporta | Encabezados confirmados | Fuente |
|---|---|---|---|
| Jira / Atlassian | Administración de la organización, exportar usuarios de un sitio. | `User ID`, `User name`, `Email`, `User status`, `Added to org`, `Org role`. Con acceso a productos suma `Last seen in <app> - <sitio>` y `Role - <app> - <sitio>`. Con grupos, `Group membership` o `Group name` y `Group id`. | [Export users from a site](https://support.atlassian.com/security-and-access-policies/docs/export-users-from-a-site/) |
| Google Workspace | Consola de administración, Directorio, Usuarios, Descargar usuarios; se eligen las columnas visibles o todas. | **No confirmados.** La ayuda oficial describe cómo descargar y las dos opciones de columnas, pero no lista los encabezados. | [Descargar una lista de usuarios](https://knowledge.workspace.google.com/admin/users/advanced/download-a-list-of-users) |
| Slack | Administración del espacio de trabajo, exportar la lista completa de miembros (propietarios y administradores, todos los planes). | **No confirmados.** La ayuda oficial indica que se recibe un CSV, sin listar columnas. | [Descargar una lista de miembros](https://slack.com/help/articles/4405848563603) |

Lo único que sabemos con certeza de los tres formatos es el campo que necesita el MVP: un email por fila. Por eso la app no exige encabezados fijos: reconoce `email`, `correo`, `mail` y similares, y deja elegir la columna de email en cada archivo (HU-05). El contrato mínimo es el de [EN-01](en-01-diccionario-datos.md).

## 2. Muestra ficticia de volumen

El script `scripts/generar-muestra-volumen.mjs` genera una muestra de 250 personas de RRHH y 1.000 filas SaaS (cuatro proveedores de 250 filas), sin datos reales.

| Dato esperado | Valor |
|---|---|
| Licencias | 1.000 |
| Coinciden con la nómina | 500 |
| Candidatas a revisión | 500 |
| Potencial mensual conocido | USD 2.253,00 |

La app produjo exactamente esos valores al cargar la muestra. Un test automatizado (`src/domain.test.ts`, «valida y concilia correctamente 250 personas y 1000 cuentas en menos de 60 segundos») cubre además el volumen máximo.

## 3. Cómo se mide el objetivo de menos de 60 segundos

El tiempo se mide desde que el usuario hace clic en «Auditar y Cruzar Datos» hasta que el resultado completo está visible en pantalla. No incluye el tiempo humano de exportar los archivos de cada plataforma.

| Medición (14/10/2026) | Resultado |
|---|---|
| Entorno | macOS, navegador integrado de Claude (Chromium), servidor de desarrollo de Vite, muestra de 250 personas y 1.000 filas |
| Del clic al resultado visible | 297 ms |
| De la carga de los archivos al resultado, con confirmación incluida | 1.481 ms, de los cuales unos 1.150 ms son esperas del propio ensayo automatizado |

La plataforma propuesta es el navegador del usuario, sin servidor. Con estos números el objetivo no necesita ajustar el volumen ni la estrategia. Es una medición de un entorno y no un compromiso de rendimiento: falta repetirla en el equipo de un usuario real y con un archivo exportado de una plataforma.

## 4. Riesgo y pregunta pendiente

- **Riesgo.** El MVP se diseñó sin ver una exportación real de Google Workspace ni de Slack. Si traen la columna de email con un nombre muy distinto, o con varias direcciones por fila, el usuario tendrá que asignarla a mano o el archivo fallará la validación.
- **Pregunta pendiente para el grupo.** ¿Quién puede descargar un CSV real, con datos de prueba, desde un espacio de Slack gratuito y desde una cuenta de Google Workspace de prueba o de los entrevistados? Con esos dos archivos se cierra el criterio 1.
- **No se inventó ninguna medición ni ningún encabezado.** Lo que no está confirmado figura como no confirmado.
