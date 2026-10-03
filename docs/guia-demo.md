# Guía de demo de SaaSGuard Express

Fecha: 03/10/2026. Recorrido sugerido: unos tres minutos para mostrar el flujo principal. Todos los datos de estos ejemplos son ficticios; las cantidades de control no son hallazgos de empresas reales.

La app debe estar abierta en el navegador local. La preparación técnica está en el [README](../README.md). Esta guía describe qué comprobar y no afirma que una revisión de navegador ya haya pasado.

## Recorrido de tres minutos con la demo integrada

1. **Cargar — 30 segundos.** En la pantalla de auditoría, pulsar Probar con datos de ejemplo. Se cargan una nómina de 12 personas y 18 licencias; el costo por defecto queda vacío. La demo ya confirma la nómina vigente. Comentar que la carga es local y que no se piden credenciales de proveedores.

2. **Cruzar — 30 segundos.** Pulsar Auditar y Cruzar Datos. Esperar 6 candidatos y USD 85,00 de ahorro potencial conocido: 20 + 45 + 12 + 8 + 0. Hay un candidato con costo desconocido y otro con costo cero. El desconocido no se incorpora al total como si valiera cero. La ausencia en RRHH pide revisión humana; no prueba egreso o inactividad.

3. **Revisar — 45 segundos.** Buscar un caso o filtrar por proveedor/estado y abrir su ficha. Escribir un responsable de revisión ficticio y una nota, por ejemplo Revisión simulada del ejemplo. Pulsar Confirmar y agregar al checklist en un candidato de costo conocido. Mostrar las alternativas Mantener cuenta / excepción y Guardar para revisar con RRHH. Confirmar prepara una tarea de revisión de baja y no revoca acceso alguno.

4. **Exportar — 45 segundos.** Pulsar Ver checklist de bajas y comprobar que sólo aparece la selección confirmada. Distinguir el subtotal de esa selección del potencial de todos los candidatos. Descargar Excel y Descargar PDF. Abrirlos para comparar email, proveedor, costo, nota, responsable, filas y subtotal con la pantalla; esta apertura es parte de la revisión que debe registrarse.

5. **Cerrar — 30 segundos.** Pulsar Cerrar auditoría y, después de conservar las descargas necesarias, Cerrar y borrar datos. La app debe quedar sin archivos, resultados ni decisiones recuperables de esa auditoría. Los archivos descargados permanecen fuera de la app. Empezar una nueva auditoría permite repetir el recorrido.

## Repetir mediante carga manual de las plantillas

Descargar la plantilla de nómina y la de licencias desde la pantalla de carga, o usar los archivos incluidos en public/ejemplos. Cargar nomina.csv en RRHH y licencias.csv en SaaS. Confirmar que la nómina representa personal vigente y dejar el costo por defecto vacío para conservar el candidato sin precio del ejemplo. Si hace falta, elegir email como columna de identidad.

Al cruzar estas plantillas se esperan 8 personas, 15 licencias, 8 coincidencias y 7 candidatos. El potencial conocido es USD 50,80, con un costo desconocido y otro de cero. Las cuentas se distribuyen así:

| Proveedor | Licencias | Coincidencias | Candidatos | Potencial conocido |
|---|---:|---:|---:|---:|
| Google Workspace | 5 | 4 | 1 | USD 20,00 |
| Slack | 5 | 3 | 2 | USD 14,50 |
| Jira | 5 | 1 | 4 | USD 16,30 |

El email de Persona 02 lleva mayúsculas y espacios externos en el CSV de licencias. Debe coincidir con la nómina tras la normalización; no debe convertirse en un octavo candidato. Los dos ejemplos son independientes: obtener 7/50,80 con las plantillas y 6/85,00 con el botón es el comportamiento previsto.

Seleccionar uno o varios casos después de la revisión ficticia, exportar XLSX/PDF y verificar que los archivos coinciden con el checklist visible. Repetir sin selección debe dejar las descargas de checklist deshabilitadas. No usar el contenido de prueba como un piloto real.

## Comprobaciones adicionales

| Caso | Acción | Qué observar |
|---|---|---|
| Reemplazo de fuente | Cambiar nómina o archivo SaaS después del cruce. | El resultado anterior queda invalidado y hay que conciliar de nuevo. |
| Error de CSV | Probar email vacío/inválido, un costo negativo, un conflicto entre duplicados o más filas que el límite. | Problema visible y cruce bloqueado; la corrección no mezcla errores del archivo anterior. |
| Costo desconocido/cero | Revisar ambos candidatos del ejemplo y cambiar un costo conocido. | Desconocido separado de cero; el potencial se actualiza sin precios inventados. |
| Varios archivos | Cargar exportaciones diferentes o repartir el ejemplo en varios CSV ficticios. | Validación conjunta y tope total de 1.000 filas SaaS; proveedor + email mantiene identidades separadas. |
| Snapshot | En resultados, elegir un proveedor y pulsar Descargar snapshot. | JSON de todos sus candidatos, no sólo del checklist. La descarga contiene datos de revisión y debe conservarse localmente con cuidado. |
| Comparación | Obtener dos snapshots completos del mismo proveedor en auditorías distintas; abrir Comparar períodos y cargarlos. | Nuevos, persistentes y ausentes con fechas y conteos; no se declara baja confirmada ni ahorro realizado. Se rechazan checklist parciales y proveedores incompatibles. |
| Registro del piloto | Abrir Registrar una ejecución real del piloto. | La demo integrada no cuenta como piloto. En un ensayo real autorizado se guarda sólo código, fecha y conteos en este navegador, hasta 100 registros. No se inventan ejecuciones para demostrar retorno. |

El cierre de auditoría elimina los datos de trabajo y comparación. El registro agregado del piloto tiene una acción separada para borrarlo y no se comparte con otros equipos o navegadores. No acredita retención comercial ni PMF.

Para la revisión formal seguir el [checklist de validación](checklist-validacion.md), anotar el commit y conservar capturas o archivos ficticios que permitan repetir lo observado. La prueba de 250 personas y 1.000 filas y el objetivo de menos de 60 segundos requieren un ensayo medido aparte del recorrido corto. Estas comprobaciones no equivalen a una evaluación de seguridad ni de disponibilidad para producción.
