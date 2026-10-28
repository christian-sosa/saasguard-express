# Evidencia de criterios de aceptación · Sprint 2

Fecha: 28/10/2026. Rama `feat/sprint2-cierre-criterios`. Entorno: macOS, Google Chrome sin interfaz controlado por Playwright, servidor de desarrollo de Vite y el juego de datos ficticios `fixtures/pruebas/02_mediano_multiplataforma`. Pruebas automatizadas al cierre: 107 pasan; `npm run check` termina sin errores.

**La prueba con los tres perfiles es una simulación con guion, no una sesión con las personas entrevistadas.** Cada perfil (IT, People Operations y Finanzas) recorre tres tareas en una sesión de navegador nueva. La simulación demuestra que las tareas se pueden completar con la interfaz actual; no mide si una persona real las completa sin ayuda (KR 1.1), que sigue pendiente.

## Cambios que surgieron al verificar HU-09 a HU-15

| HU | Criterio | Antes | Después |
|---|---|---|---|
| HU-09 | Resumen con reglas de conteo visibles | Sólo una línea al pie de la tabla | Bloque «cuentas válidas · coinciden · candidatas» con la regla de conteo |
| HU-09 | Sin candidatos no hay lista de bajas | «Ver checklist» habilitado con cero candidatas | El botón queda deshabilitado |
| HU-10 | El valor informado por el usuario queda visible | No se distinguía | La celda muestra «Informado por el usuario» |
| HU-11 | Detalle con la fórmula y los costos desconocidos | Sólo «Suma de costos conocidos» | Fórmula con la cantidad de costos conocidos, el total y las cuentas que no suman |
| HU-12 | Cada fila muestra el estado «Pendiente de revisión de baja» | Sólo un rótulo general | Columna ESTADO en el checklist |
| HU-12 | Subtotal distinto del potencial de todas las candidatas | Sólo el subtotal | «Subtotal de la selección: N de M candidatas» y el potencial total |
| HU-12, HU-13 | Costo desconocido como «Sin informar» | Excel y PDF decían «No informado» | Pantalla, Excel y PDF dicen «Sin informar» |
| HU-15 | Cerrar pide confirmar que se descargaron los reportes | Sólo un aviso | Casilla obligatoria antes de «Cerrar y borrar datos» |

También se corrigió una prueba automatizada que dependía de cómo la versión instalada de SheetJS lee los saltos de línea CRLF.

## Simulación de los tres perfiles

Script reproducible: [`evidencia/sprint2/simulacion.cjs`](evidencia/sprint2/simulacion.cjs). Resultados: [`simulacion_resultados.json`](evidencia/sprint2/simulacion_resultados.json).

| Perfil | Tarea | Resultado |
|---|---|---|
| IT | Cargar nómina y dos exportaciones y cruzar | 90 válidas, 60 coincidencias, 30 candidatas |
| IT | Filtrar Slack y buscar un email | 1 de 30 candidatas |
| IT | Confirmar dos casos y descargar Excel | 2 filas, estado «Pendiente de revisión de baja» |
| People Ops | Dejar un caso para revisar con RRHH | La nota queda visible y el caso no entra al checklist |
| People Ops | Mantener una cuenta como excepción | Filtrable como «Mantener cuenta» |
| People Ops | Cerrar la auditoría y eliminar datos | Botón bloqueado hasta confirmar descargas; sin datos al cerrar |
| Finanzas | Completar un costo sin informar | De USD 226,00 (27 costos) a USD 241,00 (28 costos) |
| Finanzas | Leer el ahorro potencial y su fórmula | Fórmula visible; 2 cuentas sin costo no suman |
| Finanzas | Descargar el PDF | PDF con la aclaración de ahorro potencial |

## Hallazgos para el backlog

- La búsqueda de alias de la ficha compara sólo la primera palabra del nombre: con nombres frecuentes lista a casi toda la nómina. Entra como tarjeta «Decisión» para el Sprint 3.
- La métrica «dos de tres tareas sin ayuda» necesita personas reales; la simulación no la reemplaza.
- Encabezados reales de Slack y Google Workspace: siguen sin un archivo real para confirmar (SPIKE-01).

## Login y roles

Pedido del 28/10/2026: login con usuario y contraseña o con Google, y usuarios de prueba con distintos accesos. Verificado en Chrome con Playwright y un client ID de prueba:

| Caso | Resultado |
|---|---|
| Contraseña incorrecta | «Usuario o contraseña incorrectos.»; el mismo mensaje si el usuario no existe |
| Cinco intentos fallidos | «Demasiados intentos» durante 30 segundos |
| Administración | Carga, confirma, anota, corrige costos y exporta |
| IT | Carga, confirma y anota; el costo no se puede editar |
| People Operations | Carga y anota; no ve «Confirmar» ni corrige costos |
| Finanzas | Carga, confirma, corrige costos y exporta Excel y PDF |
| Sólo lectura | Sólo la demo; no carga archivos, no confirma ni exporta |
| Cerrar sesión o sesión vencida | Vuelve a la pantalla de ingreso |

El ingreso real con Google necesita el cliente OAuth creado para la URL de la app. Capturas: `S2-11` (ingreso), `S2-13` (contraseña incorrecta) y `S2-14` (ficha según el rol). La simulación de los tres perfiles ahora entra con `ignacio.it`, `florencia.rrhh` y `gonzalo.finanzas` y sigue en 9 de 9.
