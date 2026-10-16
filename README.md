# SaaSGuard Express

MVP académico para cruzar una nómina vigente con exportaciones de licencias SaaS, revisar cuentas que no coinciden y preparar un checklist de bajas manuales. Está construido con React y TypeScript y procesa los archivos localmente en el navegador, tanto al ejecutar en el equipo como al servirlo desde Vercel.

**App publicada:** [saasguard-express.vercel.app](https://saasguard-express.vercel.app/) · Vercel Hobby · Sin cuentas ni base compartida.

La referencia visual es la versión v2 del [diseño de SaaSGuard en Figma](https://www.figma.com/design/7ooEdCaHVh4rrrBjXlipuA/SaaSGuard?node-id=0-1&p=f). Las cifras de la app se calculan desde los archivos cargados: no reproducen como hechos las cifras ilustrativas del prototipo. El resultado identifica candidatos a revisión y ahorro potencial, sin afirmar egresos, actividad real, accesos revocados ni ahorro logrado.

## Ejecutar y comprobar

Requiere Node.js 22.12 o superior; se recomienda Node.js 24 y npm.

En Windows, desde la raíz del repositorio, se puede iniciar con:

```powershell
.\start-saasguard.ps1
```

El script prefiere el Node.js 24 del runtime local de Codex cuando está instalado. Si ese runtime no está disponible, busca Node.js en PATH y comprueba que sea 22.12 o superior. Instala las dependencias si faltan y abre el servidor en http://127.0.0.1:4173, accesible desde este equipo. Si ese puerto está ocupado, informa el error en lugar de cambiarlo silenciosamente.

Como alternativa, con Node.js y npm disponibles en PATH:

```bash
npm ci
npm run dev
```

Abrir la dirección local que informa Vite, normalmente http://localhost:5173. La configuración para publicar el mismo frontend estático en Vercel Hobby está en [despliegue](docs/despliegue.md); no requiere variables de entorno ni Supabase.

```bash
npm run check
```

Ese comando ejecuta la comprobación de TypeScript, las pruebas automatizadas y el build. Los resultados automatizados no sustituyen la revisión de pantallas y descargas en navegador. El [checklist](docs/checklist-validacion.md) permite registrar la evidencia funcional; no se declara una revisión visual aprobada por disponer de un build.

Los ensayos realizados están en [resultado de validación](docs/resultado-validacion.md) y la comparación visual con Figma en [design-qa.md](design-qa.md).

## Qué se puede hacer

El recorrido principal implementa las funciones de HU01–HU15: descargar ejemplos, cargar CSV, elegir la columna de email, validar, conciliar, filtrar candidatos, revisar cada caso con responsable y nota, corregir costos, seleccionar un checklist y exportar Excel/PDF. El cierre elimina los archivos y decisiones de la sesión de la app.

La pantalla de carga vacía no ofrece un cierre. Si ya se ingresaron datos o archivos, **Descartar carga** los elimina y mantiene el paso de carga. Después del cruce, **Cerrar auditoría** muestra el cierre y **Nueva auditoría** permite borrar la anterior y volver directamente a cargar archivos, previa confirmación.

También hay herramientas de evolución posterior al MVP: carga de varios archivos SaaS con validación conjunta (HU16), snapshots JSON completos por proveedor para comparar períodos (HU17), y un registro agregado local del piloto (HU18). Que estas herramientas existan no acredita haber ejecutado un piloto comercial ni haber cumplido sus objetivos de recurrencia.

| Regla | Comportamiento |
|---|---|
| Archivos | CSV en UTF-8, hasta 5 MB por archivo; máximo 250 personas de RRHH y 1.000 filas SaaS en total, incluso al cargar varios archivos. |
| Validación | Emails inválidos y conflictos bloquean el cruce. Los duplicados exactos no multiplican candidatos ni costos. Reemplazar una fuente invalida el resultado anterior. |
| Identidad | Email en minúsculas y sin espacios externos; proveedor + email identifica una cuenta. No se aplica fuzzy matching ni se unifican alias, puntos, sufijos + o dominios. |
| Resultado | No aparecer en nómina requiere revisión humana. Una persona vigente sin licencia no es una cuenta huérfana. |
| Costos | Valores mensuales en USD, no negativos y con hasta dos decimales. Vacío es desconocido y no suma al potencial; cero es válido. No se convierten moneda, costos anuales ni paquetes. |
| Revisión | Cada caso permite responsable y nota; confirmar lo incorpora al checklist, mantenerlo registra una excepción y dejarlo pendiente permite revisar con RRHH. Ninguna acción da de baja una cuenta. |
| Descargas | XLSX/PDF corresponden al checklist seleccionado. El snapshot contiene todos los candidatos del proveedor, con versión, fecha y conteos, aunque no estén seleccionados. |

Los reportes y snapshots pueden contener nombres, emails y notas de revisión. Son archivos descargados al equipo del usuario y deben manejarse como tales. El repositorio contiene únicamente ejemplos sintéticos; no deben añadirse nóminas, exportaciones reales ni reportes con datos personales.

## Dos ejemplos intencionalmente distintos

| Ejemplo | Personas RRHH | Licencias | Candidatos | Potencial conocido | Costo desconocido | Costo cero |
|---|---:|---:|---:|---:|---:|---:|
| Botón Probar con datos de ejemplo | 12 | 18 | 6 | USD 85,00 | 1 | 1 |
| Plantillas nomina.csv + licencias.csv | 8 | 15 | 7 | USD 50,80 | 1 | 1 |

El botón carga la demo integrada; las plantillas son otro conjunto pequeño para repetir el recorrido mediante carga manual. Ambos incluyen Google Workspace, Slack y Jira con precios de prueba, sin representar contratos reales. Las cifras diferentes son esperadas. La [guía de demo](docs/guia-demo.md) muestra cómo revisar ambos casos.

## Juegos de CSV para pruebas manuales

Los cuatro juegos de [fixtures/pruebas](fixtures/pruebas/LEEME.txt) contienen únicamente datos sintéticos. La carpeta [pruebas en Google Drive](https://drive.google.com/drive/folders/1i1J6-JrD6jGmc6fOfWLYmAj0pHw1pOBO) permite compartirlos para probar la página publicada. Cada juego incluye `GUIA.txt`; no deben mezclarse archivos de juegos distintos.

| Juego | Personas RRHH | Licencias | Candidatos | Potencial mensual conocido |
|---|---:|---:|---:|---:|
| 01_simple | 5 | 8 | 3 | USD 24,50 |
| 02_mediano_multiplataforma | 30 | 90 | 30 | USD 226,00 |
| 03_grande_limite | 250 | 1.000 | 200 | USD 1.875,00 |
| 04_validacion_errores, versión corregida | 4 | 7 | 3 | USD 15,50 |

En el cuarto juego se cargan primero los CSV de `con_errores`, que deben bloquear el cruce; luego se reemplazan por los de `corregidos`. Los juegos mediano y corregido incluyen costos desconocidos y costos cero para comprobar que se distinguen. El juego grande alcanza los límites globales admitidos: cargar juntos sus cuatro CSV de licencias. El [archivo de resultados esperados](fixtures/pruebas/expected-results.json) registra los conteos e importes exactos, incluido el caso inválido. Los emails válidos usan `example.test`; no hay datos de personal real.

## Datos y límites del prototipo

Actualización del 16/10/2026: los CSV, las cuentas y las decisiones viven en memoria de la página. Se descartan al recargar, cerrar y borrar la auditoría o alcanzar la próxima medianoche de Argentina (00:00 de `America/Argentina/Buenos_Aires`, actualmente 03:00 UTC), con un máximo absoluto de 24 horas desde el inicio. La actividad no renueva ese plazo. Esta regla reemplaza la conservación anterior de hasta 24 horas sin corte diario.

El registro del piloto es la única persistencia adicional en el navegador: `localStorage` conserva como máximo 100 ejecuciones del día de Argentina con código de organización, fecha y conteos de candidatos/seleccionados, sin nómina, nombres ni emails. El cierre manual de la auditoría conserva esos agregados del día, que pueden borrarse con su propia acción y vencen igualmente a medianoche. Al leerlos, la app elimina de esa clave los registros anteriores al día actual, los futuros y los inválidos. Es un registro de un solo navegador, no una base compartida ni una medición de PMF; la demo integrada no se registra como piloto real.

La limpieza se ejecuta en el navegador: si la pestaña está activa, se programa para medianoche; si estaba suspendida, se comprueba al volver a ella o al intentar una operación. Si el navegador estaba cerrado, los agregados vencidos se eliminan al abrir la app nuevamente. No hay un proceso nocturno ni una base de datos en Vercel o Supabase. Vercel entrega la aplicación; los datos de trabajo permanecen en cada navegador. Los CSV originales y los reportes o snapshots descargados permanecen en el equipo del usuario hasta que éste los borre.

No hay backend, cuentas de usuarios ni permisos de rol autenticados. Los responsables escritos son datos de revisión, no autorizaciones. No se implementan OAuth, APIs de proveedores, bajas automáticas, IA ni pagos. Este MVP no incluye SLA ni una evaluación de seguridad de producción. El tiempo informado corresponde al cruce en el navegador; para evaluar el objetivo del recorrido completo hay que registrar también el entorno y la medición correspondiente.

## Decisión técnica y próximos pasos

El usuario eligió React + TypeScript y un repositorio privado para avanzar sin contratar servicios. La elección fue provisional el 03/10; los avances del 08/10 y 16/10 ya documentan React/TypeScript, procesamiento en navegador y ausencia de autenticación como el alcance adoptado del MVP. La [decisión tecnológica](docs/decision-tecnologica.md) conserva ese historial y explica la diferencia con la propuesta No-Code / Low-Code original. Los entregables históricos de Drive y sus proyecciones económicas no se reescriben mediante este cambio.

No-code configura interfaz, datos y reglas en herramientas visuales; low-code combina ese trabajo con módulos de código o integraciones. Esta app de React es desarrollo con código, aunque siga el diseño de Figma. La elección aporta control del código, versionado, pruebas y ejecución local; requiere mantener dependencias y lógica, y deja de usar el editor visual y los servicios integrados de datos/workflows del stack original. No incorpora automáticamente autenticación, base compartida ni workflows cloud.

Si el equipo necesita operación compartida, el siguiente paso es acordar un backend con autenticación, permisos y tratamiento del dato, y luego revisar despliegue, costos y pruebas. También puede evaluarse una alternativa low-code que combine una interfaz o automatización visual con el motor de conciliación. Cualquiera de esas opciones exige un acuerdo nuevo; no está incluida en este MVP actual.
