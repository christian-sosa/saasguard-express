# EN-01 · Diccionario de datos y casos de control

Fecha: 14/10/2026. Contrato de entrada de SaaSGuard Express para el MVP. La columna «Origen» distingue lo que **confirman las fuentes** de lo que el equipo **adoptó** para poder construir.

## 1. Contrato de entrada

| Fuente | Campo | Obligatorio | Uso | Origen |
|---|---|---|---|---|
| Nómina de RRHH | `email` | Sí | Identidad para el cruce | Adoptado: el email es lo único que toda exportación trae |
| Nómina de RRHH | `nombre` | No | Apoyo para revisar cada caso | Adoptado |
| Nómina de RRHH | `area` | No | Apoyo para revisar | Adoptado |
| Nómina de RRHH | `estado` | No | Si declara baja o inactivo, la fila se rechaza | Adoptado: la nómina representa sólo personal vigente |
| Exportación SaaS | `email` | Sí | Identidad para el cruce | Adoptado; Atlassian confirma `Email` ([spike](spike-01-formatos-csv.md)) |
| Exportación SaaS | `proveedor` | No | Proveedor de la cuenta; si falta se usa el proveedor por defecto de la auditoría | Adoptado |
| Exportación SaaS | `plan` | No | Informativo | Adoptado |
| Exportación SaaS | `costo_mensual` | No | USD por cuenta y por mes, hasta dos decimales; vacío significa desconocido y cero es válido | Adoptado: las exportaciones de las plataformas no traen costos |
| Exportación SaaS | `estado` | No | Informativo | Adoptado |

La nómina no pide motivo de egreso ni otros datos del personal. Cada auditoría lleva un proveedor, ya sea por columna o por el proveedor por defecto.

## 2. Unidad de cuenta

Una cuenta es **proveedor + email normalizado** (minúsculas y sin espacios externos). El mismo email en dos proveedores son dos cuentas. Los duplicados exactos se cuentan una vez y no multiplican candidatas ni ahorro; una identidad repetida con datos distintos bloquea el cruce hasta corregirla. No se unifican alias, puntos, sufijos `+` ni dominios.

## 3. Límites adoptados

| Límite | Valor | Origen |
|---|---|---|
| Archivo | CSV en UTF-8, hasta 5 MB | Adoptado |
| Personas de RRHH | 250 | Adoptado en SPIKE-01 |
| Filas SaaS en total | 1.000 | Adoptado en SPIKE-01 |
| Sesión | 24 horas | Adoptado: política de datos del MVP |
| Objetivo de tiempo | Menos de 60 segundos | Consigna del proyecto; medido en el [spike](spike-01-formatos-csv.md) |

## 4. Catálogo de casos límite

| Caso | Resultado esperado | Dónde se verifica |
|---|---|---|
| Email vacío o inválido | Error con la fila de origen; no se concilia hasta corregir o excluir | `bloquea email inválido, nómina inactiva y proveedor contradictorio` |
| Email duplicado exacto | Se cuenta una vez y deja un aviso con la fila | `consolida duplicados exactos y deja un aviso con la fila de origen` |
| Email duplicado con datos distintos | Error en ambas filas; no se elige una versión | `no elige una versión de una cuenta con costo contradictorio` |
| Nombre igual con email distinto | No se concilia por nombre; el caso queda para revisión humana | `no usa nombres iguales para reconciliar ni cuenta personal sin licencia como candidato` |
| Persona de RRHH sin licencia | No es una cuenta huérfana | el mismo test |
| Costo desconocido | Se informa aparte y no suma al potencial | `suma sólo precios conocidos y mantiene el denominador desconocido visible` |
| Costo cero | Es válido y distinto de desconocido | `distingue costo vacío de cero, admite decimal local y rechaza valores ambiguos` |
| Mismo email en dos proveedores | Dos cuentas independientes | `cuenta el mismo email en dos proveedores como dos licencias independientes` |
| Email con mayúsculas y espacios | Se compara normalizado y se conserva el original | `conserva el email original y expone la identidad normalizada por separado` |

## 5. Archivos de control y resultado esperado

Los archivos están en `public/ejemplos/` y son ficticios: `nomina.csv` y `licencias.csv`. Todos los correos terminan en `@example.test`.

| Control | Resultado esperado |
|---|---|
| Personas vigentes | 8 |
| Filas de licencias | 15: 5 de Google Workspace, 5 de Slack y 5 de Jira |
| Coinciden con la nómina | 8, incluida una fila con el email en mayúsculas y entre espacios |
| Candidatas a revisión | 7 |
| Candidatas con costo desconocido | 1 |
| Candidatas con costo cero | 1 |
| Potencial mensual conocido | USD 50,80 (20 + 7,25 + 7,25 + 8,15 + 8,15 + 0) |

El 14/10/2026 la app reprodujo esos valores con los dos archivos. Para el volumen máximo, `scripts/generar-muestra-volumen.mjs` genera otra muestra con su resultado esperado.
