# Sesión con usuarios del Sprint 3

Kit para la prueba con los tres perfiles entrevistados. Es el primer compromiso del Sprint 3 (acción 1 de la retrospectiva del Sprint 2) y hay que registrarla antes de la Review del 12/11/2026.

**Todavía no se hizo.** Este documento prepara la sesión y no contiene resultados. El ensayo automatizado del Sprint 2 no cuenta como prueba con usuarios: demuestra que las tareas se pueden completar, no que una persona las complete sin ayuda.

## Qué se quiere saber

1. **Meta (KR 1.1):** cada perfil completa dos de tres tareas sin ayuda.
2. Dónde se traba o duda cada persona, en sus propias palabras.
3. Si la cifra de ahorro y el checklist le sirven para decidir qué hacer después.

## Quién y cuándo

Christian Sosa (BA) agenda las sesiones. La acción de la retrospectiva se cumple con las tres registradas antes del 12/11.

| Perfil | Persona | Usuario de prueba | Fecha y hora | Facilita | Observa |
|---|---|---|---|---|---|
| IT | Ignacio | `ignacio.it` | A definir | A definir | A definir |
| People Operations | Florencia | `florencia.rrhh` | A definir | A definir | A definir |
| Finanzas | Gonzalo | `gonzalo.finanzas` | A definir | A definir | A definir |

Las contraseñas están en [`usuarios-de-prueba.md`](usuarios-de-prueba.md).

## Antes de cada sesión

- [ ] Confirmar la URL de la versión que se va a probar y anotar su commit.
- [ ] Entrar con el usuario del perfil y comprobar que la app carga.
- [ ] Tener a mano `nomina.csv`, `licencias_google.csv` y `licencias_slack_jira.csv` de `fixtures/pruebas/02_mediano_multiplataforma`.
- [ ] Pedirle a la persona que use sólo esos datos ficticios, nunca una nómina real.
- [ ] Preguntar si se puede grabar. Sin permiso expreso, se toman notas y no se graba.

## Guion de 20 minutos

**Apertura (2 minutos).** «Estamos probando la aplicación, no a vos. Si algo no se entiende, es información útil para nosotros. Te pedimos que vayas contando lo que pensás mientras lo usás. Los datos son ficticios. No vamos a poder ayudarte enseguida: primero queremos ver cómo lo resolvés.»

**Tareas (13 minutos).** Se lee una tarea por vez, sin nombrar botones ni pantallas.

| Perfil | Tarea | Se completa cuando |
|---|---|---|
| IT | 1. «Cargá la nómina y las dos exportaciones y averiguá cuántas cuentas hay que revisar.» | Dice 30 candidatas |
| IT | 2. «Buscá la cuenta persona035 de Slack.» | Abre o señala esa fila |
| IT | 3. «Pasá dos casos a la lista de bajas y bajá el Excel para mesa de ayuda.» | Descarga un Excel con 2 cuentas |
| People Operations | 1. «Querés consultar con RRHH la cuenta persona033 de Jira antes de decidir. Dejalo anotado.» | El caso queda con nota y fuera del checklist |
| People Operations | 2. «La cuenta persona034 de Google Workspace es de la recepción y se tiene que quedar. Registralo.» | El caso queda como excepción |
| People Operations | 3. «Terminaste. Asegurate de que no queden los datos del personal en la aplicación.» | Cierra y borra los datos |
| Finanzas | 1. «La cuenta persona032 de Google Workspace no tiene costo. Sabés que vale USD 15 por mes. Cargalo.» | El total pasa de USD 226,00 a USD 241,00 |
| Finanzas | 2. «Explicame de dónde sale el ahorro que muestra la pantalla.» | Explica la fórmula y las cuentas que no suman |
| Finanzas | 3. «Bajá un informe en PDF con esa cuenta para mandárselo a quien decide.» | Descarga el PDF con la cuenta |

**Cierre (5 minutos).**

1. ¿Qué fue lo más confuso?
2. ¿Qué harías con este resultado en tu trabajo?
3. ¿Confiarías en la cifra de ahorro? ¿Por qué?
4. ¿Qué te faltó para decidir?
5. ¿Hoy cómo resolvés esto, y cuánto tiempo te lleva?

## Cómo se registra cada tarea

| Resultado | Qué significa |
|---|---|
| Sin ayuda | La completó sola, aunque haya dudado |
| Con ayuda | Hubo que darle una pista o decirle dónde mirar |
| No completó | Abandonó, o el facilitador cortó la tarea después de 5 minutos |

Si la persona pregunta algo, primero se responde «¿vos qué harías?». Una pista cuenta como ayuda.

## Planilla por sesión

Copiar una por persona en la tarjeta «Prueba del recorrido con los tres entrevistados» de Trello.

```text
Perfil y persona:
Fecha y hora:
Facilitó / observó:
Versión probada (URL y commit):
Se grabó: sí / no

Tarea 1: sin ayuda / con ayuda / no completó · minutos: · qué pasó:
Tarea 2: sin ayuda / con ayuda / no completó · minutos: · qué pasó:
Tarea 3: sin ayuda / con ayuda / no completó · minutos: · qué pasó:
Tareas sin ayuda: _ de 3

Frases textuales:
Respuestas del cierre:
Errores o cosas que no se entendieron:
Cambios que propone el equipo para el backlog:
```

## Después de las tres sesiones

1. Tildar en la tarjeta sólo los perfiles que probaron de verdad y adjuntar sus planillas.
2. Calcular la meta por perfil y contarla tal cual, también si no se cumple.
3. Pasar cada hallazgo al Backlog como tarjeta «Decisión», con costo. Los ajustes entran al Sprint 4.
4. Llevar el resumen a la Review.

Si una sesión no se puede hacer, se registra como no realizada y su motivo. No se completa con el ensayo automatizado ni con respuestas supuestas.
