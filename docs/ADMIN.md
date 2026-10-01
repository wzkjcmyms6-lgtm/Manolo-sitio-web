# Administrador (diseño, fase 1)

## Quién es admin
No hay roles hoy. Propuesta: existe `admins/{uid}` → ese usuario es admin.
El documento **lo crea el dueño a mano en la consola de Firebase**; la app
no puede crearlo (reglas `write: false`). La interfaz solo muestra la
campana si ese documento existe, pero la protección real son las reglas.

## Evento de login
- Se registra cuando Firebase Auth confirma la sesión
  (`onAuthStateChanged`), usando `user.metadata.lastSignInTime` como clave:
  cambia solo con un inicio de sesión real, no al reabrir la app.
- Id `uid_loginMs` + reglas "solo crear" ⇒ **idempotente**: reintentos o
  varias pestañas no duplican. Se recuerda en el teléfono la última clave
  enviada para no reintentar en cada apertura.
- Se registran todos los inicios de sesión; la campana no avisa de los del propio admin (filtro en su teléfono).
- Limitación honesta: sin servidor, el evento lo escribe el cliente; las
  reglas garantizan que cada usuario solo puede escribir **su propio**
  evento, con hora del servidor y campos fijos. Un evento 100 % de servidor
  requeriría Cloud Functions / Identity Platform (costo) — no se propone.

## Estado: implementado (fase 1)

- `js/auth.js` lanza `manolo:inicio-sesion` solo cuando Firebase confirma
  usuario y contraseña; `js/accesos.js` escribe el evento y maneja la
  campana; `js/accesos-logica.js` (probado) arma la clave y la bandeja.
- Reglas completas en **`firestore.rules`** (incluye las de siempre y las
  del Feed). La campana solo aparece cuando existe `admins/{tu uid}`.

## Cómo activarlo (lo hace el dueño, una sola vez)

1. **Tu UID**: Firebase → *Authentication* → *Usuarios* → tu usuario
   (`…@manolo-panel.local`) → copia el **UID de usuario**.
2. **Marcarte como admin**: Firebase → *Firestore Database* → *Datos* →
   *Iniciar colección* → ID de colección `admins` → ID de documento: pega
   tu UID → agrega un campo `nombre` (string) con tu nombre → *Guardar*.
3. **Reglas**: Firebase → *Firestore Database* → *Reglas*. Si lo que hay
   es igual a `docs/feed-reglas.md`, reemplázalo todo por el contenido de
   `firestore.rules` y toca *Publicar*. Si ves algo distinto, no lo
   reemplaces: avisa para juntarlas.
4. **Probar**: abre MANOLO → aparece la campana. Pide a otra persona que
   entre con su usuario → te llega "Nuevo inicio de sesión". En el
   teléfono de esa persona no debe aparecer la campana.

Mientras no se hagan estos pasos la app funciona igual que antes: el
registro del acceso falla en silencio y la campana no aparece.
