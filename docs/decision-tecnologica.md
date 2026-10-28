# Decisión técnica del prototipo SaaSGuard Express

Registro inicial: 03/10/2026. En esa fecha la elección de React era provisional; los avances posteriores del 08/10 y 16/10 ya la documentan como arquitectura del MVP.

Actualización del 16/10/2026: el usuario autorizó elegir y ejecutar la publicación gratuita. Se conserva React + TypeScript + Vite y se elige Vercel Hobby para servir el frontend estático. El flujo actual no necesita Supabase: los CSV siguen en el navegador y no se modifica el proyecto de Fábrica de Fútbol, que tiene usuarios reales. La [configuración de despliegue](despliegue.md) describe esta decisión. No se reescriben los entregables históricos.

## Contraste con los documentos actuales de Drive — 16/10/2026

El avance [5_08102026_AvanceSprint1](https://docs.google.com/document/d/1TY8iDOh51QWAlqIsFX-kQ30gfZQ_aKxTyjWG5qcqdU0/edit) ya registra React/TypeScript, el procesamiento en navegador, la sesión local con borrado al cerrar o a las 24 horas y declara: «No hay autenticación, base compartida ni auditoría centralizada». La falta de login es un recorte explícito del MVP; los responsables escritos en una ficha no son cuentas ni permisos autenticados.

El [Documento de Avance del Proyecto creado el 16/10](https://docs.google.com/document/d/1IcrMWWyWSMkaUOHGxuXpOtN_u8fhPLOCfAw1M7JjpWE/edit), para el parcial del 22/10, propone una «Auditoría gratuita para probar sin registrarse». Su arquitectura mantiene nóminas fuera de un servidor/base propios; el roadmap pospone histórico y cobro a Release 2, y multiempresa/reglas a Release 3.

El [modelo de negocio del 24/09](https://docs.google.com/document/d/1ISIYdp4mtt7crZQMpQCZZSb9p8fhvWD1/edit) describe la visión comercial, con histórico, varios usuarios y acceso por rol en distintos planes pagos. Eso no equivale al alcance implementado ni se obtiene al publicar una URL. El MVP tampoco aplica los límites comerciales por cliente del plan Express. Comparar snapshots descargados y guardar agregados en un navegador no constituye histórico cloud.

La sección histórica siguiente conserva la situación y el análisis del 03/10. Las referencias a una elección técnica pendiente corresponden a esa fecha y quedaron superadas por los avances citados. Las cifras financieras originales y el documento de enlaces de Drive todavía requieren su propia actualización; no fueron modificados en esta tarea.

## Registro histórico del 03/10/2026

Para esta demostración vamos a usar React y TypeScript, ejecutar la app localmente y versionar el código en un repositorio privado de GitHub. Así podemos convertir el diseño de Figma en una app funcional, revisar el código y probar el cruce de CSV sin contratar servicios de procesamiento o almacenamiento. GitHub Free permite repositorios privados; esta decisión no exige contratar Codespaces, hosting ni servicios de CI adicionales. [Planes de GitHub](https://github.com/pricing).

La app procesa los archivos en el navegador y mantiene los CSV y resultados en la sesión. El usuario de la app no necesita una cuenta ni subir su nómina a una base de datos en la nube. El repositorio guarda código y ejemplos ficticios, nunca CSV de personal real. La eliminación, el aislamiento de la sesión y la ausencia de datos personales en registros deben comprobarse con el checklist; no se dan por resueltos sólo por elegir React.

## Relación con lo que ya se entregó

El documento 5_20082026_Proyecto.docx propone una WebApp No-Code / Low-Code con Bubble / Webflow + Make + Airtable. El modelo de negocio del 24/09 reafirma una plataforma No-Code y la estimación de costos usa Bubble + Airtable como supuesto de consumo. React + TypeScript es una implementación distinta de esa propuesta.

Esta decisión permite avanzar con el pedido actual del usuario y debe conversar el equipo antes de presentarla como arquitectura definitiva. Conservamos los entregables y sus costos tal como están: no recalculamos el P&L, no cambiamos el supuesto de USD 4 por cuenta activa ni sustituimos los documentos del Drive. El costo cero de ejecutar este prototipo local no demuestra costo cero de un producto comercial.

## No-code, low-code y la app actual

| Enfoque | Cómo se construye | Qué significa para SaaSGuard |
|---|---|---|
| No-code | Se configuran pantallas, datos y reglas con herramientas visuales. | La propuesta original de Bubble, Airtable y Make concentra ese trabajo en servicios de plataforma; no equivale a generar este repositorio de React. |
| Low-code | Se combina configuración visual con módulos de código o integraciones para las partes que lo necesitan. | Es una alternativa que el equipo puede evaluar, por ejemplo conservar un motor de conciliación en código y conectarlo a una interfaz o automatización visual. Esa combinación no está implementada en esta app. |
| React + TypeScript | Se escribe y mantiene código para la interfaz, el cruce, las validaciones y las exportaciones. | Es la implementación actual. Figma aporta el diseño de referencia; usar un diseño visual no convierte el desarrollo en no-code. |

Con React ganamos un código que puede versionarse, revisarse y probarse en GitHub, y un motor local que puede ejecutarse sin contratar una base de datos o un workflow cloud. También podemos cambiar de hosting o adaptar la lógica sin reconstruirla desde un editor propietario. Esto requiere que el equipo mantenga el código, las dependencias y las pruebas.

Dejamos de usar el editor visual y los servicios de datos/workflows integrados de la plataforma no-code prevista. La app actual tampoco reemplaza sus servicios cloud con un backend propio: no aporta autenticación, base compartida ni ejecución programada de workflows. Si esas funciones son necesarias para operar con varias personas, deben diseñarse e implementarse como un siguiente paso. Las diferencias de mantenimiento y servicios no se trasladan automáticamente a los costos de los entregables anteriores.

## Opciones no-code revisadas

Consulta de fuentes oficiales: 03/10/2026. Los límites corresponden a esa consulta y deben revisarse antes de contratar o diseñar un piloto sobre ellos.

| Opción | Qué aporta | Límite relevante para este TP |
|---|---|---|
| Bubble | Editor visual de interfaz, base de datos y workflows. | Free sirve para la versión de desarrollo; la publicación live aparece en los planes pagos. Una app de Bubble no se exporta como código ejecutable independiente. |
| Airtable | Almacenamiento tabular que puede acompañar un flujo no-code. | Free incluye 1.000 registros por base y 1.000 llamadas API por workspace al mes. El límite de registros se comparte entre las tablas de la base. |
| Make | Automatizaciones visuales entre pasos y aplicaciones. | Free incluye 1.000 créditos al mes y un intervalo mínimo de 15 minutos para escenarios programados. |

Las funciones visuales, los datos y la lógica de Bubble se describen en sus páginas de [diseño](https://bubble.io/design), [datos](https://bubble.io/data) y [workflows](https://bubble.io/logic). La diferencia entre desarrollo gratuito y publicación live está en [Bubble Pricing](https://bubble.io/pricing). El límite de portabilidad está en [Application and data ownership](https://manual.bubble.io/account-and-marketplace/application-and-data-ownership).

Los límites de Airtable están en [Airtable plans overview](https://support.airtable.com/articles/2277136852-airtable-plans-overview). Los créditos y la frecuencia de escenarios están en [Make Pricing](https://www.make.com/en/pricing).

Para el ensayo propuesto de 250 personas y 1.000 filas SaaS, guardar una fila por persona y otra por licencia en una misma base de Airtable requeriría 1.250 registros, por encima de los 1.000 del plan Free. Es una inferencia para ese diseño de almacenamiento; no significa que todos los diseños consuman lo mismo ni que el ensayo ya se haya ejecutado.

En Make, un escenario que ejecute una acción facturable por cada una de 1.000 filas podría consumir aproximadamente 1.000 créditos sólo en ese paso; otros módulos o repeticiones agregarían consumo. La cuenta depende del escenario, de los módulos y del procesamiento por lotes. Es una estimación para detectar riesgo, no una garantía de capacidad ni de precio. Los 15 minutos de programación tampoco son una medición del tiempo que tarda el cruce después de iniciarlo.

## Alcance de esta implementación

El MVP cubre carga dual de CSV, validación, conciliación por email normalizado, revisión humana de candidatos, costos mensuales en USD, ahorro potencial, checklist y exportación a XLSX/PDF. La ausencia de un correo en la nómina crea una candidata a revisión; una persona debe validar el caso y realizar cualquier baja en el proveedor.

Quedan fuera OAuth y APIs de proveedores, bajas automáticas, IA para decidir identidades y cobro de suscripciones. Además del recorrido HU01–HU15, la app ya incluye como extras técnicos la carga multifuente con validación conjunta (HU16), los snapshots JSON completos para comparar auditorías del mismo proveedor (HU17) y el registro agregado local del piloto (HU18). En el backlog se planificaron como evolución posterior; su presencia técnica no demuestra haber ejecutado un piloto real, validado recurrencia ni medido PMF. El registro local guarda código, fecha y conteos en un solo navegador, sin autenticar usuarios ni compartir datos entre equipos.

El prototipo local no incluye cuentas de usuarios, persistencia cloud, SLA ni una evaluación de seguridad para producción. El objetivo de menos de 60 segundos y el recorrido funcional deben medirse con datos ficticios y evidencia. Antes de usarlo con nóminas reales habría que acordar despliegue, acceso, tratamiento del dato y operación con el equipo.

## Actualización 28/10/2026: login con Google

El equipo decidió sumar en el Sprint 2 un inicio de sesión con Google (tarjeta «Decisión · Login con Google»). Reemplaza el recorte «No hay autenticación» sólo en esto: quien opera la app se identifica con su cuenta de Google. Sigue sin haber backend, base compartida ni permisos por rol, y la integración por API con Google Workspace sigue fuera del alcance. Detalle y límites en [despliegue](despliegue.md#login-con-google--28102026).
