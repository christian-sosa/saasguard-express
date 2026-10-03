# Revisión visual y funcional — SaaSGuard Express

Fecha: 03/10/2026. Alcance: MVP local funcional basado en el prototipo v2 de Figma. Las cifras ilustrativas del diseño no se presentan como resultados reales.

## Evidencia y normalización

- Referencia: [Figma](https://www.figma.com/design/7ooEdCaHVh4rrrBjXlipuA/SaaSGuard?node-id=0-1&p=f), frames de carga y resultado del prototipo navegable v2.
- Source visual truth paths: `design-evidence/figma-carga.png`, `design-evidence/figma-resultados.png`.
- Implementation screenshot paths: `design-evidence/app-carga-final.png`, `design-evidence/app-resultados-chrome.png`, `design-evidence/app-mobile.png`, `design-evidence/app-mobile-ficha.png`.
- Viewport de comparación: 1760 × 1000 CSS px. Captura Figma: 1760 × 1000 px. Captura app: 1745 × 991 px; el navegador resta el área de barra de desplazamiento en la captura. Paneles de ambos: 1660 CSS px de ancho. Panel Figma: 900 px de alto; app final: aproximadamente 949 px en carga y 940 px en resultados.
- Density normalization: comparación a escala 1:1, sin ampliar la app. Los composites añaden margen de fondo al área restante de captura; no deforman las imágenes.
- Estado: archivos válidos cargados en ambas vistas de carga; resultado sin filtros y sin ficha abierta en ambas vistas de resultados. Figma usa su dataset ilustrativo; la app usa la demo sintética de 12 personas, 18 licencias y 6 candidatas.
- Full-view comparison evidence: `design-evidence/comparacion-carga-final.png`, `design-evidence/comparacion-resultados-final.png`. También se inspeccionó la captura nítida de Chrome individualmente.
- Focused region comparison evidence: `design-evidence/comparacion-foco-final.png` — cabecera y métricas, a tamaño nativo.
- Capturas y archivos de prueba se conservan localmente en `design-evidence/`, excluidos de Git. El código, las pruebas y este informe sí están versionados.

## Superficies revisadas

| Superficie | Resultado |
|---|---|
| Tipografía | Inter local en pesos 400/500/600/700. Jerarquía, cabecera, números, títulos y texto de tabla consistentes con la referencia; el texto móvil envuelve dentro del panel. |
| Espaciado y estructura | Fondo navy, panel blanco, radio 20 px, cabecera, dos tarjetas de carga, cuatro métricas, tabla y gráfico lateral, tres acciones inferiores. Las tarjetas de carga conservan 670 px de ancho en la comparación. |
| Colores | Violeta principal, superficies rosa/ámbar/lavanda, cabecera de tabla oscura y aviso de privacidad verde. Estados de revisión diferenciados por color y texto. |
| Imágenes e iconos | Marca SG original extraída de la referencia como PNG; no se redibujó el logo. Iconos de biblioteca Tabler para controles estándar. Gráfico generado desde los datos con Recharts. No hay ilustraciones ni fotos en estas pantallas. |
| Contenido | Español natural, costos mensuales conocidos separados de desconocidos, ahorro potencial y revisión humana explícitos. Sin fingir bajas, inactividad, cuentas autenticadas ni resultados de un piloto. |
| Interacciones y accesibilidad | Inputs etiquetados, estados deshabilitados, errores legibles, botones funcionales, foco de modal y cierre por teclado. Pruebas de escritorio y móvil. |

## Historial de hallazgos y correcciones

1. **[P2, corregido] Densidad y altura de carga.** La primera versión con controles funcionales superaba ampliamente la altura del frame. Se redujeron espacios, padding y zona de selección; la vista final conserva tarjetas, preview colapsado y confirmación de nómina. Evidencia posterior: `app-carga-final.png` y composite de carga.
2. **[P2, corregido] Filtros recortados en móvil.** La anchura mínima de tabla se propagaba a toda la columna de casos. Se añadieron `min-width: 0` y una pista de grid `minmax(0, 1fr)`. La tabla ahora desplaza horizontalmente dentro de su contenedor; ambos filtros quedan visibles. Evidencia: `app-mobile.png`, medición de ancho del documento sin overflow horizontal.
3. **[P2, corregido] Gráfico vacío durante captura inicial.** La animación dejaba temporalmente el donut sin sectores. Se desactivó la animación inicial: los tres sectores aparecen desde el resultado. Evidencia: captura Chrome, tres sectores y totales consistentes.
4. **[P2, corregido] Lista de 750 candidatas desplazaba las acciones demasiado lejos.** Se limitó el alto de la tabla y se fijó su cabecera dentro del scroll. Ensayo real de navegador: contenedor 430 px, 750 filas y acciones accesibles. Evidencia: `app-volumen.png`.
5. **[P1, corregido] Costo editado fuera del rango numérico seguro.** La ficha ahora valida el importe y el subtotal prospectivo antes de cambiar el estado. El ensayo con `900719925474099.00` mostró error sin romper la app.
6. **[P2, corregido] Reemplazo de snapshots.** Se invalidan lecturas previas por índice y se limpia el resultado al elegir otro archivo. Reemplazar con JSON inválido deshabilita la comparación; cerrar y reabrir elimina ambos snapshots.
7. **[P2, corregido] Resultado técnico en comparación.** Los conteos se muestran como grupos desplegables con emails y cambios de importe; las fechas muestran UTC y hora de 24 horas. Evidencia: `app-comparacion.png`.

## Diferencias intencionales

- La app incluye selector de columnas, preview de tres filas, confirmación de nómina vigente y costos del contrato. Estos controles exigidos por el flujo aumentan unos 40–49 px el panel respecto del mock; las acciones siguen visibles en la comparación de escritorio.
- El mock ilustra egresos, última actividad, roles y precios comerciales. Un CSV y la nómina vigente sólo permiten conciliación por email: la app muestra candidatas y costo desconocido, sin inferir esos hechos.
- Se empieza directamente por la auditoría local. La opción aprobada no incluye backend ni autenticación; no se simula el login del Figma.
- En móvil, la tabla mantiene todas las columnas con desplazamiento local y el gráfico lateral se omite. Las métricas y filtros conservan la información principal.
- La comparación de períodos y el snapshot son extras funcionales; los filtros del mock se implementan como inputs visibles.

## Verificación

- TypeScript aprobado; 74 pruebas funcionales y 4 de empaquetado aprobadas.
- Carga real de las dos plantillas por selector de archivos: 8 personas, 15 licencias, 7 candidatas, USD 50,80, un costo desconocido y uno cero.
- Demo integrada: 12/18/6, USD 85,00. Responsable requerido; selección y exclusión del checklist; nota pendiente conservada.
- Excel y PDF descargados desde Chrome, abiertos y examinados: sólo la cuenta confirmada, costo USD 20 y responsable de prueba. También se validan desconocidos, costo cero, multipágina y texto de fórmula mediante pruebas automatizadas.
- Snapshots ficticios: una candidata nueva, una persistente, cero ausentes y un cambio de costo; detalle desplegable comprobado.
- Cierre comprobado: no quedan nombres/emails en la vista cerrada. Conteos del piloto son una persistencia separada, sin nómina, nombres ni emails. No se registró un piloto ficticio como real.
- Consola del navegador: sin errores ni warnings en la revisión final de la sesión probada.

## Checklist de implementación

- [x] Capturar y comparar carga/resultados con el Figma.
- [x] Revisar tipografía, ritmo, tokens, assets y contenido.
- [x] Corregir los hallazgos P0/P1/P2 detectados.
- [x] Probar archivo, conciliación, revisión, exportación, comparación y cierre.
- [x] Comprobar móvil y volumen máximo con datos sintéticos.
- [x] Dejar una vista local limpia para la revisión del usuario.

## Pulido posterior

- [P3] Dividir las librerías de exportación en chunks para reducir la descarga inicial. El build actual funciona y avisa de un chunk grande.
- [P3] Si el equipo incorpora backend o datos reales, definir autenticación, operación y revisión de seguridad antes de ampliar el alcance. No forma parte de la aceptación visual del prototipo.

final result: passed
