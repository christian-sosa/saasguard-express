# Resultado de validación del prototipo

## Publicación y validación del 16/10/2026

La app está publicada en [saasguard-express.vercel.app](https://saasguard-express.vercel.app/), en Vercel Hobby. Se mantiene el motor en el navegador y no se conectó Supabase ni se modificó Fábrica de Fútbol.

- Node.js 24.19.0, Vite 6.4.4 y SheetJS 0.20.3 desde su distribución oficial.
- TypeScript, **94/94 pruebas funcionales**, build y **4/4 pruebas del empaquetado Sites** aprobados. `npm audit` completo: **0 vulnerabilidades**. [CI en GitHub](https://github.com/christian-sosa/saasguard-express/actions/runs/38914981418) aprobada para el primer commit desplegado `3fe26f7`.
- Se corrigió el rechazo de un total de costos fuera del rango seguro antes de actualizar la auditoría, con regresiones de rechazo/recuperación y preservación de desconocido frente a cero. La prueba XLSX mantiene comprobaciones de texto literal y ausencia de fórmulas, contemplando la normalización CRLF a LF del lector actualizado.
- HTTP sin cookies: inicio y enlace profundo devuelven 200 y la app; logo, plantillas, JS y CSS coinciden por SHA-256 con el build local. MIME y caché de assets correctos. Las rutas de archivos fuente o entorno solo devuelven el shell HTML de la SPA y no exponen los archivos.
- CSP y encabezados presentes en producción; conexiones externas de la app bloqueadas. No se observaron errores ni advertencias de consola en el recorrido probado.
- Navegador en producción: demo con 12 personas, 18 licencias, 6 candidatas y USD 85; confirmación sin responsable rechazada; una cuenta revisada generó checklist por USD 20. Los botones XLSX y PDF mostraron confirmación de exportación sin errores. Los bytes, contenido y celdas literales de los documentos están cubiertos por las pruebas automatizadas; esta comprobación no inspeccionó nuevamente los archivos guardados por Chrome.
- Cierre confirmado sin nombres ni emails; recarga posterior con auditoría vacía. No se registró la demo como ejecución real del piloto.

La [configuración y operación](despliegue.md) quedan versionadas. Se conservan debajo los ensayos históricos del 03/10; la afirmación original de que aún no había hosting corresponde a esa fecha.

## Ensayo histórico del 03/10/2026

Fecha: 03/10/2026. Entorno: Windows, Node.js 24.19.0, Vite 6.4.2, navegador de Codex y Chrome. Datos sintéticos exclusivamente.

Se aprobaron TypeScript, 74 pruebas funcionales (dominio 29, exportaciones 10, registro agregado 35) y 4 pruebas del empaquetado. El build de producción genera el frontend y los archivos del template de hosting; no se publicó la app en un servicio externo.

## Ensayos realizados

| Ensayo | Resultado observado |
|---|---|
| Demo integrada | 12 personas, 18 licencias, 6 candidatas y USD 85 de potencial conocido. Un costo desconocido y otro cero. |
| Carga manual de plantillas | 8 personas, 15 licencias, 7 candidatas y USD 50,80. Cruce deshabilitado hasta confirmar nómina vigente. |
| Volumen máximo | 250 personas y 1.000 licencias; 750 candidatas y USD 750. Tabla con scroll interno de 430 px. |
| Tiempo de volumen | Aproximadamente 1.497 ms para carga por herramientas, confirmación, cruce y lectura del resultado; 2 ms informados por el motor del navegador. Un ensayo separado de parseo, validación y cruce en Node tardó aproximadamente 10,7 ms. |
| Revisión | Responsable obligatorio al confirmar. Se conserva una nota pendiente para RRHH. Costo numérico excesivo rechazado sin romper el resultado. |
| Checklist | Selección explícita, costos cero/desconocidos diferenciados, subtotal de seleccionadas separado del total general. |
| Descargas | Excel válido con hojas Resumen y Checklist; PDF abierto y renderizado. La selección de una cuenta produjo esa cuenta, costo USD 20 y responsable de prueba. Archivos de prueba en Descargas. |
| Comparación | Dos snapshots completos ficticios: 1 nueva, 1 persistente, 0 que dejaron de aparecer, 1 cambio de costo. Detalle por email y fechas UTC visibles. |
| Reemplazo inválido | Elegir JSON inválido elimina el snapshot previo y deshabilita comparar. Cerrar la ventana borra ambos snapshots. |
| Cierre | Vista de cierre sin nombres/emails. Nueva auditoría limpia. Descargas anteriores permanecen fuera de la app. |
| Móvil | 390 × 844 CSS px, filtros completos, tabla con scroll local, ficha dentro de la ventana y acciones accesibles por scroll. |

La medición de volumen es una observación de este entorno y estos archivos. No incluye el tiempo humano de exportar archivos de proveedores ni acredita un SLA. Los conteos del piloto no se alimentaron con ensayos ficticios.

## Cobertura y límites

Las pruebas automatizadas cubren normalización, filas y aliases, duplicados/conflictos, límites globales, centavos, snapshots completos, cronología/proveedor, expiración de 24 horas, registros locales y exportaciones. El checklist de aceptación sigue disponible para revisión del equipo: este informe no sustituye una validación humana exhaustiva de cada CA ni la investigación comercial.

La revisión visual y sus evidencias locales se documentan en [design-qa.md](../design-qa.md). Los entregables antiguos, el Drive y los tableros de Trello no fueron modificados al construir la app.
