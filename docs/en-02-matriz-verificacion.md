# EN-02 · Matriz de verificación del recorrido completo

Fecha: 06/11/2026. Alcance: los criterios de aceptación (CA) de SPIKE-01, EN-01 y HU-01 a HU-15, tal como figuran en las tarjetas de Trello.

## Cómo se usa

- **Preparar la matriz no equivale a probar el producto.** Cada caso parte como `Pendiente` y sólo se registra `Pasó` al ejecutar la verificación y guardar la evidencia.
- La persona de la columna **Verifica** es quien figura como «Revisa» en la tarjeta. Marca el resultado sobre la versión que se va a publicar, con la fecha y el commit.
- La evidencia nueva se anexa en la tarjeta de Trello de la historia y su enlace se pega en la columna **Evidencia**.
- La evidencia previa no da el caso por aprobado: sirve de guía, porque se tomó sobre una versión anterior.
- Si un caso falla, se registra `Falló`, se abre una tarjeta y la historia vuelve a Testing.

## Referencias

| Código | Significado |
|---|---|
| J1 | `fixtures/pruebas/01_simple` |
| J2 | `fixtures/pruebas/02_mediano_multiplataforma` |
| J3 | `fixtures/pruebas/03_grande_limite` |
| J4 | `fixtures/pruebas/04_validacion_errores` |
| J5a | `fixtures/pruebas/05_casos_borde/cero_candidatos` |
| J5b | `fixtures/pruebas/05_casos_borde/homonimo_y_duplicados` |
| Ej | Plantillas `public/ejemplos/nomina.csv` y `public/ejemplos/licencias.csv` |
| S1 | Evidencia previa en [`evidencia-sprint1.md`](evidencia-sprint1.md) |
| S2 | Evidencia previa en [`evidencia-sprint2.md`](evidencia-sprint2.md) |
| CT-nn | Caso transversal de la tabla siguiente |

Todos los datos son ficticios. Los usuarios de prueba están en [`usuarios-de-prueba.md`](usuarios-de-prueba.md).

## Casos transversales

Son los caminos normales y alternativos que pide EN-02. El guion [`en02-ensayo.cjs`](evidencia/sprint3/en02-ensayo.cjs) los ejecutó el 06/11/2026 en Google Chrome, sobre la integración de `feat/sprint2-login-google` con las ramas `fix/sprint3-login-robusto` (`3cd9843`) y `feat/sprint3-alias-nombre-completo` (`0819df2`). Conviene repetirlo sobre la versión que se publique. Resultados: [`en02-ensayo_resultados.json`](evidencia/sprint3/en02-ensayo_resultados.json).

Un guion comprueba lo que se le programó: no reemplaza a la persona que verifica ni a una sesión con usuarios. Por eso la columna **Verifica** sigue en `Pendiente`.

| Caso | Datos | Pasos | Resultado esperado | Ensayo del 06/11 | Verifica |
|---|---|---|---|---|---|
| CT-01 Cero candidatos | J5a | Cargar y cruzar | 3 coincidencias, 0 candidatas, «No encontramos cuentas fuera de la nómina» y checklist deshabilitado ([captura](evidencia/sprint3/S3-CT01_cero_candidatos.png)) | Pasó | Marcelo · Pendiente |
| CT-02 Errores de CSV | J4 | Cargar `con_errores`, observar y reemplazar por `corregidos` | Cruce bloqueado, filas con error informadas; al corregir no quedan errores viejos: 7 cuentas, 4 coincidencias y 3 candidatas ([captura](evidencia/sprint3/S3-CT02_errores_de_csv.png)) | Pasó | Christian · Pendiente |
| CT-03 Duplicados | J5b | Cargar, abrir los avisos y cruzar | «Duplicado exacto de la fila 4»; 5 cuentas únicas, 4 candidatas y USD 23,00 | Pasó | Christian · Pendiente |
| CT-04 Correo normalizado | J2 | Cargar y cruzar | Emails con mayúsculas y espacios no generan falsas candidatas: 90 cuentas, 60 coincidencias y 30 candidatas | Pasó | Marcelo · Pendiente |
| CT-05 Homónimo | J5b | Buscar `aperez@example.test` y abrir la ficha y sus posibles alias | Sigue como candidata; la ficha muestra a `ana.perez@example.test` y aclara que el nombre no confirma identidad ([captura](evidencia/sprint3/S3-CT05_homonimo.png)) | Pasó | Christian · Pendiente |
| CT-06 Costo desconocido | J5b | Leer la fórmula y buscar `elena.vera@example.test` | La fila dice «Sin informar» y la fórmula aclara que esa cuenta no suma | Pasó | Pedro · Pendiente |
| CT-07 Exportación de la selección | J5b | Confirmar dos casos y descargar Excel y PDF | Excel con las 2 cuentas seleccionadas y «Sin informar», sin cuentas no seleccionadas; PDF válido | Pasó | Marcelo · Pendiente |
| CT-08 Tiempo de HU-07 | J3 | Medir desde el clic en «Auditar y Cruzar Datos» hasta ver «Casos detectados» | Menos de 60 segundos con 250 personas y 1.000 licencias: 1.000 cuentas, 800 coincidencias y 200 candidatas | Pasó: 275 ms | Pedro · Pendiente |
| CT-09 Eliminación de HU-15 | J1 | Cruzar, cerrar la auditoría, confirmar las descargas, recargar y abrir otra sesión | Borrar pide confirmar descargas; sin datos en pantalla, almacenamiento del navegador, consola, recarga ni otra sesión | Pasó | Christian · Pendiente |

Lo que el guion no cubre y queda para la persona: abrir el Excel y el PDF con sus programas, leer si los mensajes se entienden y confirmar el tiempo en la versión publicada.

## Matriz por criterio de aceptación

### SPIKE-01 y EN-01

| CA | Caso ficticio | Resultado esperado | Verifica | Evidencia | Estado |
|---|---|---|---|---|---|
| SPIKE-01.1 | Revisar `spike-01-formatos-csv.md` | Compara encabezados de al menos dos exportaciones, con origen y campos obligatorios | Marcelo | S1 | Pendiente |
| SPIKE-01.2 | Abrir J3 | Muestra de 250 personas y 1.000 filas con resultado esperado, sin nómina real | Marcelo | S1 | Pendiente |
| SPIKE-01.3 | Leer el método de medición | Indica cómo medir, en qué plataforma y si hay que ajustar el objetivo de 60 segundos | Marcelo | S1, CT-08 | Pendiente |
| SPIKE-01.4 | Revisar los pendientes del documento | Lo que no se pudo probar queda como riesgo, sin mediciones inventadas | Marcelo | S1 | Pendiente |
| EN-01.1 | Revisar `en-01-diccionario-datos.md` | Email obligatorio, nombre de apoyo, proveedor por auditoría y nómina sólo con personal vigente | Pedro | S1 | Pendiente |
| EN-01.2 | Revisar la unidad de cuenta | Proveedor + email normalizado; los duplicados exactos no multiplican | Pedro | S1, CT-03 | Pendiente |
| EN-01.3 | Revisar el catálogo de casos | Email vacío, duplicado, nombre igual con otro email, costo desconocido y mismo email en dos proveedores | Pedro | S1 | Pendiente |
| EN-01.4 | Revisar archivos y resultados esperados | Archivos ficticios con resultado escrito; límites adoptados distinguidos de los confirmados | Pedro | S1 | Pendiente |

### HU-01 a HU-08 · Carga y cruce

| CA | Caso ficticio | Resultado esperado | Verifica | Evidencia | Estado |
|---|---|---|---|---|---|
| HU-01.1 | Descargar los dos ejemplos | Dos CSV ficticios, uno por fuente, que respetan EN-01 | Christian | S1 | Pendiente |
| HU-01.2 | Abrir la guía de preparación | Distingue licencias de nómina y muestra las columnas obligatorias | Christian | S1 | Pendiente |
| HU-01.3 | Consultar la biblioteca de ejemplos | Incluye el núcleo corporativo de SPIKE-01; Google Workspace, Slack y Jira priorizados | Christian | S1 | Pendiente |
| HU-01.4 | Leer la guía de carga | Aclara que la exportación es manual y que SaaSGuard no se conecta al proveedor | Christian | S1 | Pendiente |
| HU-02.1 | Cargar licencias de J1 | Muestra archivo, proveedor y filas leídas antes del cruce | Marcelo | S1 | Pendiente |
| HU-02.2 | Cargar otro CSV de J1 sobre el anterior | Reemplaza la selección sin duplicar registros | Marcelo | S1 | Pendiente |
| HU-02.3 | Cargar sólo licencias | No se puede cruzar hasta tener una nómina validada | Marcelo | S1 | Pendiente |
| HU-02.4 | Cruzar J1 | Proveedor y fecha de auditoría asociados; la fecha no se presenta como egreso | Marcelo | S1 | Pendiente |
| HU-03.1 | Cargar la nómina de J1 | Muestra archivo y personas, separado de la fuente SaaS | Pedro | S1 | Pendiente |
| HU-03.2 | Intentar continuar con la nómina | Pide confirmar que es personal vigente | Pedro | S1 | Pendiente |
| HU-03.3 | Reemplazar la nómina después de un cruce | El resultado anterior deja de valer y hay que volver a cruzar | Pedro | S1 | Pendiente |
| HU-03.4 | Completar la carga | No pide motivo de egreso ni datos que el cruce no necesita | Pedro | S1 | Pendiente |
| HU-04.1 | Cargar un archivo vacío, un `.xlsx` y uno sin email | Explica el problema y cómo corregirlo; ofrece asignar la columna | Christian | S1 | Pendiente |
| HU-04.2 | Cargar `con_errores` de J4 | Informa el email inválido con su fila; no presenta la auditoría como completa | Christian | S1, CT-02 | Pendiente |
| HU-04.3 | Cargar J5b y `con_errores` de J4 | Consolida el duplicado una vez; los valores contradictorios quedan para revisión | Christian | S1, CT-02, CT-03 | Pendiente |
| HU-04.4 | Cargar más filas que el límite | Muestra el máximo permitido y deja reemplazar el archivo | Christian | S1 | Pendiente |
| HU-04.5 | Reemplazar `con_errores` por `corregidos` | No quedan errores del archivo anterior | Christian | S1, CT-02 | Pendiente |
| HU-05.1 | Cargar un CSV con otro encabezado | Permite elegir la columna de email y muestra al menos tres filas | Pedro | S1 | Pendiente |
| HU-05.2 | Intentar continuar sin asignar email | No deja continuar ni elegir una columna inexistente | Pedro | S1 | Pendiente |
| HU-05.3 | Reemplazar el archivo | La asignación se reinicia | Pedro | S1 | Pendiente |
| HU-05.4 | Cargar columnas adicionales | No participan del cruce ni del informe | Pedro | S1 | Pendiente |
| HU-06.1 | Cruzar J5a | ` ANA.LOPEZ@EXAMPLE.TEST ` coincide con `ana.lopez@example.test` | Marcelo | S1, CT-04 | Pendiente |
| HU-06.2 | Abrir la ficha de un email con mayúsculas | Muestra el original y el normalizado | Marcelo | S1 | Pendiente |
| HU-06.3 | Comparar `ana+tag@` con `ana@` | No elimina puntos, sufijos, dominios ni alias | Marcelo | S1 | Pendiente |
| HU-06.4 | Cargar `con_errores` de J4 | El email inválido sigue el camino de error y no es candidato | Marcelo | S1, CT-02 | Pendiente |
| HU-07.1 | Cruzar J1 | Muestra «Coincide con nómina» y «Candidata a revisión» | Pedro | S1 | Pendiente |
| HU-07.2 | Cruzar J2 | Una persona sin cuenta no se cuenta como licencia huérfana | Pedro | S1 | Pendiente |
| HU-07.3 | Cruzar J5b y J5a | Cuenta por proveedor + email, sin duplicar; si no hay candidatos muestra cero | Pedro | S1, CT-01, CT-03 | Pendiente |
| HU-07.4 | Cruzar J3 y medir | Resultado correcto en menos de 60 segundos, con el tiempo registrado | Pedro | S1, CT-08 | Pendiente |
| HU-07.5 | Leer la vista del resultado | Aclara que la ausencia en nómina requiere validación humana | Pedro | S1 | Pendiente |
| HU-08.1 | Abrir una ficha de J5b | Muestra nombre y email y permite consultar la nómina cargada | Christian | S1, CT-05 | Pendiente |
| HU-08.2 | Revisar `aperez@example.test` en J5b | El mismo nombre con otro email no se reconcilia ni se toma como egreso | Christian | S1, CT-05 | Pendiente |
| HU-08.3 | Guardar para revisar con RRHH, con nota | Queda marcado con la nota y no entra al checklist | Christian | S1, S2 | Pendiente |
| HU-08.4 | Volver al resultado | La marca se ve en la sesión y los archivos originales no cambian | Christian | S1 | Pendiente |

### HU-09 a HU-15 · Revisión, costo y cierre

| CA | Caso ficticio | Resultado esperado | Verifica | Evidencia | Estado |
|---|---|---|---|---|---|
| HU-09.1 | Cruzar J2 | Resumen con cuentas válidas, coincidencias y candidatas, con las reglas visibles | Marcelo | S2 | Pendiente |
| HU-09.2 | Buscar un email y filtrar por estado | La tabla incluye proveedor, nombre, email y estado; los datos de base no cambian | Marcelo | S2 | Pendiente |
| HU-09.3 | Filtrar Slack en J2 | El total general sigue separado de las filas filtradas | Marcelo | S2 | Pendiente |
| HU-09.4 | Cruzar J5a | Explica que no hay candidatos y no crea una lista de bajas vacía | Marcelo | S2, CT-01 | Pendiente |
| HU-10.1 | Cargar importe, cero y vacío en J2 | Importe mensual USD no negativo; cero es sin costo y vacío es desconocido | Pedro | S2 | Pendiente |
| HU-10.2 | Probar negativo, texto y formato inválido | Muestra error y no calcula con ese valor | Pedro | S2 | Pendiente |
| HU-10.3 | Leer la guía de costos | Pide costo mensual comparable y no convierte moneda, anuales ni paquetes | Pedro | S2 | Pendiente |
| HU-10.4 | Cambiar un importe en J2 | Actualiza el cálculo y muestra «Informado por el usuario» | Pedro | S2 | Pendiente |
| HU-11.1 | Cruzar J2 | «Ahorro potencial mensual (USD)» suma una vez cada costo conocido: USD 226,00 | Pedro | S2 | Pendiente |
| HU-11.2 | Leer el detalle en J5b | Muestra la fórmula y cuántas cuentas tienen costo desconocido | Pedro | S2, CT-06 | Pendiente |
| HU-11.3 | Usar cuentas de USD 20 y USD 45 y una sin costo | Total USD 65 y una cuenta no monetizada | Pedro | S2 | Pendiente |
| HU-11.4 | Cruzar J5b | El duplicado no infla; el mismo email en Slack y Jira aporta un costo por proveedor | Pedro | S2, CT-03 | Pendiente |
| HU-11.5 | Leer el resultado económico | No usa el 25% inicial ni afirma ahorro realizado, devolución o cancelación | Pedro | S2 | Pendiente |
| HU-12.1 | Cruzar J5b sin seleccionar | Aparecer como candidata no basta para entrar al checklist | Marcelo | S2, CT-07 | Pendiente |
| HU-12.2 | Confirmar un caso | La fila muestra proveedor, nombre, email, costo o «Sin informar», estado y responsable o nota | Marcelo | S2 | Pendiente |
| HU-12.3 | Excluir una cuenta | Sale del checklist y del subtotal, y sigue entre las candidatas | Marcelo | S2 | Pendiente |
| HU-12.4 | Confirmar parte de las candidatas | Distingue el subtotal del potencial total | Marcelo | S2 | Pendiente |
| HU-12.5 | Preparar la revisión | No hay acciones para cancelar cuentas y exportar no marca una baja como hecha | Marcelo | S2 | Pendiente |
| HU-13.1 | Exportar la selección de J5b | `.xlsx` con las cuentas, columnas, fecha y subtotal | Christian | S2, CT-07 | Pendiente |
| HU-13.2 | Comparar con la pantalla | Valores, filas y subtotal coinciden; desconocidos como «Sin informar» | Christian | S2, CT-07 | Pendiente |
| HU-13.3 | Usar un nombre que empieza con `=` | Se exporta como texto y no se ejecuta como fórmula | Christian | S2 | Pendiente |
| HU-13.4 | Intentar exportar sin selección | Informa qué falta y no descarga un archivo | Christian | S2 | Pendiente |
| HU-13.5 | Abrir el archivo en una planilla | Encabezados, emails y costos se leen sin perder caracteres | Christian | S2 | Pendiente |
| HU-14.1 | Exportar el PDF de J5b | Proveedor, fecha, cuentas, costos, subtotal y costos desconocidos | Marcelo | S2, CT-07 | Pendiente |
| HU-14.2 | Leer el resumen | Aclara que el ahorro es potencial y que la baja es manual | Marcelo | S2 | Pendiente |
| HU-14.3 | Exportar una selección larga de J3 | Conserva encabezados, no corta emails ni deja filas afuera | Marcelo | S2 | Pendiente |
| HU-14.4 | Comparar Excel, PDF y checklist | Cantidad de cuentas y subtotal coinciden | Marcelo | S2 | Pendiente |
| HU-14.5 | Intentar generar sin selección | Informa el motivo y no genera un informe | Marcelo | S2 | Pendiente |
| HU-15.1 | Abrir la pantalla de carga | Informa antes de cargar que los datos son de la sesión y cómo vencen | Christian | S2 | Pendiente |
| HU-15.2 | Cerrar y borrar en J1 | Pide confirmar las descargas y no quedan datos recuperables | Christian | S2, CT-09 | Pendiente |
| HU-15.3 | Abrir otra sesión | No ve ni descarga archivos o resultados de la primera | Christian | S2, CT-09 | Pendiente |
| HU-15.4 | Revisar almacenamiento y consola con datos ficticios | Emails, nombres y nómina no quedan en registros técnicos | Christian | S2, CT-09 | Pendiente |
| HU-15.5 | Leer el alcance de la eliminación | Aclara que borrar no elimina los Excel o PDF descargados | Christian | S2 | Pendiente |

## Fuera de esta matriz

- HU-16, HU-17 y la métrica del piloto son posteriores al MVP. Están implementadas como extras en la app y su validación sigue pendiente en [`checklist-validacion.md`](checklist-validacion.md).
- La meta «dos de tres tareas sin ayuda» se mide con personas reales. Su guion está en la sesión con usuarios del Sprint 3.
