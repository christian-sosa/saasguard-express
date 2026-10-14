# Evidencia de criterios de aceptación · Sprint 1

Fecha: 14/10/2026. Rama `feat/sprint1-cierre-criterios`. Entorno: macOS, navegador integrado de Claude (Chromium), servidor de desarrollo de Vite y datos ficticios. La verificación la ejecutó Claude a pedido de Marcelo Mansilla recorriendo la app con los archivos de `public/ejemplos/` y archivos armados para cada caso. Pruebas automatizadas al cierre: 83 pasan; `npm run check` termina sin errores.

Esta evidencia sustituye al checklist inicial sólo para HU-01 a HU-08 y no reemplaza una prueba con los tres perfiles entrevistados, que sigue pendiente.

## Capturas

Están en [`docs/evidencia/`](evidencia/), con datos ficticios: `HU-01_guia_de_preparacion`, `HU-02_HU-03_carga_de_archivos`, `HU-04_errores_de_carga`, `HU-05_asignacion_de_columna`, `HU-06_email_original_y_normalizado`, `HU-07_candidatas_y_coincidencias`, `HU-08_revisar_con_RRHH_y_fecha_de_auditoria` y `SPIKE-01_HU-07_ensayo_de_volumen`. En la última, el rótulo con el tiempo medido se agregó a la captura y no es parte de la app.

## Resultado por tarjeta

| Tarjeta | Criterios cumplidos | Estado propuesto |
|---|---|---|
| HU-01 | 4 de 4 | Terminado |
| HU-02 | 4 de 4 y 4 casos de prueba | Terminado |
| HU-03 | 4 de 4 | Terminado |
| HU-04 | 5 de 5 | Terminado |
| HU-05 | 4 de 4 | Terminado |
| HU-06 | 4 de 4 | Terminado |
| HU-07 | 5 de 5 | Terminado |
| HU-08 | 4 de 4 | Terminado |
| EN-01 | 4 de 4 | En validación: es un documento que el equipo tiene que leer y aceptar |
| SPIKE-01 | 3 de 4 | En validación: falta confirmar encabezados de Google Workspace y Slack |

## Observaciones

| HU | Qué se observó |
|---|---|
| HU-01 | Dos plantillas descargables con datos ficticios (`nomina.csv`, `licencias.csv`). Guía «Cómo preparar los archivos» con columnas obligatorias, distinción entre nómina y exportación, ejemplos de Google Workspace, Slack y Jira, y aclaración de exportación manual sin conexión a las plataformas. |
| HU-02 | La tarjeta muestra archivo, cantidad de licencias y proveedores. Cargar otro archivo reemplaza el anterior. Sin nómina el botón de cruzar queda deshabilitado. El resultado muestra la fecha de auditoría con la aclaración «no es fecha de egreso» y los proveedores. |
| HU-03 | Nómina con nombre y cantidad de personas, separada de la fuente SaaS. El cruce exige confirmar que es personal vigente. No existe un camino para reemplazar la nómina conservando un resultado viejo: cerrar la auditoría borra todo. No se pide motivo de egreso. |
| HU-04 | Archivo vacío: mensaje con cómo corregirlo. Archivo `.xlsx`: «Elegí un archivo CSV. Las planillas XLSX deben exportarse a CSV primero». Email vacío o inválido con número de fila. Duplicado exacto consolidado con aviso; identidad contradictoria marcada en ambas filas. 251 personas: muestra el máximo de 250 y se reemplaza el archivo. Al cargar uno corregido, los errores del anterior desaparecen. |
| HU-05 | Con un encabezado no estándar se elige la columna de email y se ven tres filas de ejemplo. Sólo se pueden elegir columnas existentes y el cruce no se habilita con una columna inválida. Cambiar de archivo reinicia la asignación. Las columnas no asignadas no entran al cruce ni a los informes. |
| HU-06 | `  ZED.Test@Example.TEST ` se compara como `zed.test@example.test` y la ficha muestra el original y el normalizado. ` PERSONA02@EXAMPLE.TEST ` coincide con la nómina. `ana+tag@…` no se confunde con `ana@…`. Un email inválido sigue el camino de HU-04. |
| HU-07 | Con los ejemplos: 7 candidatas, 8 coincidencias, USD 50,80. Las coincidencias se listan con «Coincide con nómina». Una persona sin licencia no es candidata y los duplicados no suman. Con 250 personas y 1.000 filas el resultado correcto (500 candidatas, USD 2.253,00) aparece entre 297 ms y 1.129 ms después del clic, según la corrida. La vista aclara que la ausencia en nómina requiere revisión humana. |
| HU-08 | La ficha muestra nombre y email y permite consultar la nómina. No se concilia por nombre. «Guardar para revisar con RRHH» deja la nota y la fila pasa a «Revisar con RRHH» con la nota visible; el caso no entra al checklist. La app no modifica los archivos originales. |

## Diferencias que se corrigieron al verificar

| Antes | Después |
|---|---|
| La tarjeta de la exportación no mostraba el proveedor. | Muestra los proveedores detectados. |
| El resultado no mostraba la fecha de auditoría. | Muestra la fecha con la aclaración de que no es de egreso. |
| Las coincidencias sólo se contaban de forma implícita. | Se cuentan y se listan con «Coincide con nómina». |
| Guardar para RRHH dejaba la etiqueta «Por revisar». | Muestra «Revisar con RRHH» y la nota. |
| No había una guía dentro de la app. | Guía «Cómo preparar los archivos». |
| El archivo vacío no decía cómo corregirlo. | El mensaje indica cómo. |

## Pendiente

- Prueba del recorrido con los tres perfiles entrevistados (tarjeta del Sprint 1).
- Encabezados reales de Google Workspace y Slack (SPIKE-01, criterio 1).
- Aceptación del equipo de EN-01 y SPIKE-01.
