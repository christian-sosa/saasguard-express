# Checklist de validación del MVP

Fecha: 03/10/2026. Referencia: backlog de SaaSGuard Express, HU01–HU15. Este documento prepara la revisión y no afirma que los casos ya hayan pasado.

Para cada fila registrar versión o commit, navegador, datos usados, resultado observado, persona que revisa y evidencia. Marcar una HU como cumplida requiere comprobar sus criterios de aceptación; tener una pantalla o un botón no alcanza.

## Datos ficticios incluidos

Los ejemplos están en public/ejemplos/nomina.csv y public/ejemplos/licencias.csv. Todos los nombres y correos son sintéticos; no proceden del TP, de alumnos ni de una nómina real. Los precios son valores de prueba, no tarifas publicadas de los proveedores.

| Control del conjunto completo | Resultado esperado |
|---|---|
| Personas vigentes en nómina | 8 |
| Filas de licencias | 15: 5 de Google Workspace, 5 de Slack y 5 de Jira |
| Coincidencias con nómina | 8 |
| Cuentas candidatas a revisión | 7 |
| Candidatas con costo desconocido | 1, con campo costo_mensual vacío |
| Candidatas con costo cero | 1, que permanece distinta del costo desconocido |
| Ahorro potencial mensual conocido | USD 50,80: 20 + 7,25 + 7,25 + 8,15 + 8,15 + 0 |

El mismo caso puede probarse por proveedor: Google Workspace tiene 4 coincidencias y 1 candidata (USD 20); Slack tiene 3 coincidencias y 2 candidatas (USD 14,50); Jira tiene 1 coincidencia y 4 candidatas (USD 16,30, una de costo desconocido y una de costo cero). Para la auditoría de una sola fuente del MVP, tomar las filas del proveedor que se prueba. El caso consolidado no da por implementada la HU16.

## HU01–HU15: recorrido requerido

| HU | Comprobar | Resultado esperado / estado inicial |
|---|---|---|
| HU01 — Ejemplos y guía | Descargar ambos CSV y leer el contrato de entrada. | Datos ficticios legibles; email obligatorio, nómina vigente y exportación manual explicados. Pendiente. |
| HU02 — Carga SaaS | Cargar CSV válido, reemplazarlo y tratar de cruzar sin nómina. | Nombre, proveedor y filas visibles; reemplazo sin duplicar; cruce bloqueado hasta tener nómina. Fecha de auditoría distinta de fecha de egreso. Pendiente. |
| HU03 — Nómina | Cargar la referencia vigente, confirmarla y reemplazarla después de un cruce. | Conteo separado de SaaS; confirmación de vigencia; resultado previo invalidado; sin pedir motivo de egreso. Pendiente. |
| HU04 — Errores | Probar archivo vacío, extensión incorrecta, email vacío/inválido, duplicados, valores contradictorios y exceso de filas. | Errores por fila y corrección o exclusión explícita; duplicados consolidados una vez; contradicciones visibles; recarga limpia. Pendiente. |
| HU05 — Columnas | Cargar un encabezado distinto, elegir email y reemplazar el archivo. | Vista previa de al menos 3 filas; email asignado en ambas fuentes; asignación reiniciada; columnas no usadas fuera del cruce/informe. Pendiente. |
| HU06 — Normalización | Comparar email con mayúsculas y espacios; probar puntos, sufijos +, alias y dominios distintos. | Sólo minúsculas y espacios externos normalizados; original visible; sin equiparar identidades diferentes. Email inválido sigue HU04. Pendiente. |
| HU07 — Conciliación | Ver coincidencias/candidatas, personal sin licencia, duplicados y cero candidatos; medir un ensayo del volumen acordado. | Identidad proveedor + email, cero explícito, candidatos sujetos a revisión humana. Objetivo menor a 60 segundos con tiempo registrado. Pendiente. |
| HU08 — Revisión humana | Revisar mismo nombre con correos distintos y marcar Revisar con RRHH con nota. | Sin matching automático por nombre; nota visible en sesión; caso no seleccionado por defecto; archivos originales intactos. Pendiente. |
| HU09 — Resumen/filtros | Buscar por email, filtrar estado y probar una auditoría sin candidatos. | Proveedor/nombre/email/estado visibles; total general separado del filtro; datos de base sin cambios; explicación clara del caso cero. Pendiente. |
| HU10 — Costos | Cambiar un importe, ingresar cero, dejarlo vacío y probar negativos, texto y formatos inválidos. | USD mensual no negativo por cuenta; vacío significa desconocido; error visible para valores inválidos; sin convertir monedas, anualidades o paquetes. Pendiente. |
| HU11 — Ahorro | Comprobar los importes del ejemplo, duplicados y una cuenta sin precio; variar un costo. | Suma conocida una vez por proveedor + email, desconocidos informados, fórmula visible y actualización del total. Rótulo Ahorro potencial mensual (USD). Pendiente. |
| HU12 — Checklist | Seleccionar y excluir cuentas, editar responsable operativo/nota y comparar subtotales. | Selección explícita; proveedor, nombre, email, costo/estado visibles; subtotal propio; sin ejecutar ni declarar bajas. Pendiente. |
| HU13 — XLSX | Exportar selección, abrirla en planilla y probar texto que comienza con =. | Archivo .xlsx válido; filas, fecha y subtotal iguales al checklist; desconocidos como Sin informar; texto no ejecutado como fórmula; sin selección no exporta. Pendiente. |
| HU14 — PDF | Exportar la misma selección y una lista que ocupe varias páginas. | Filas completas, encabezados legibles, fecha/proveedor/costos/desconocidos/subtotal iguales a XLSX; nota de potencial y baja manual; sin selección no genera informe. Pendiente. |
| HU15 — Cierre/datos | Consultar política, cerrar y eliminar, recargar, abrir otra sesión y revisar almacenamiento/registros. | Política visible antes de cargar; confirmación de reportes; datos de sesión eliminados, sin acceso desde otra sesión ni datos personales en logs; expiración máxima de 24 h. Descargas previas bajo control del usuario. Pendiente. |

## Casos transversales

- [ ] Cambiar cualquiera de las fuentes obliga a volver a conciliar; no permite exportar un resultado anterior como vigente.
- [ ] Una persona de nómina sin licencia no aparece como cuenta huérfana.
- [ ] Duplicar una fila exacta no aumenta candidatos ni ahorro.
- [ ] El mismo email en proveedores diferentes corresponde a cuentas diferentes.
- [ ] Cero candidatos, cero costo y costo desconocido tienen mensajes/resultados diferentes.
- [ ] El total de candidatos y el subtotal seleccionado se distinguen también en las exportaciones.
- [ ] Los botones no llaman APIs, no piden credenciales de proveedores ni afirman haber cancelado una cuenta.
- [ ] El diseño puede usarse con teclado, muestra errores legibles y conserva los datos necesarios al cambiar de vista.
- [ ] Se mide el ensayo propuesto de 250 personas y 1.000 filas SaaS con datos sintéticos; no se presenta como capacidad comprobada antes de hacerlo.
- [ ] Los 4 casos adicionales de HU02, si se ejecutan, se registran como pruebas complementarias y no aumentan el número de CA del backlog.

## HU16–HU18: posteriores al MVP

| HU | Validación posterior necesaria | Estado |
|---|---|---|
| HU16 — Varias plataformas | Acumular fuentes sin sustituirlas; identidad y costos por proveedor; filtro y nueva conciliación al cambiar nómina. | Implementada como extra; validación del equipo pendiente. |
| HU17 — Comparar snapshots | Exportar todos los candidatos con versión/fecha/conteos; rechazar checklist parcial o proveedores incompatibles; distinguir nuevos/persistentes/ausentes y variación de costo; sin conservar nómina en servidor ni inferir baja/ahorro logrado. | Implementada como extra; validación del equipo pendiente. |
| HU18 — Piloto de recurrencia | Definir primera auditoría y período; usar código de organización, fecha y finalización; reportar denominador y retorno espontáneo/acompañado con registros reales, sin nombres/emails/nómina. | Registro agregado implementado; estudio real pendiente. No completar con datos inventados. |

El uso de estos CSV verifica comportamiento de prueba. No acredita investigación de campo, retención comercial, PMF ni disposición a pagar. Las verificaciones ejecutadas deben conservar su evidencia y cualquier diferencia respecto del backlog.
