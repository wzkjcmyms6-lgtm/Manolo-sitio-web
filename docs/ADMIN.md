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

## Reglas a agregar (se publican en la consola; borrador)

```
function esAdmin() {
  return conSesion() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
match /admins/{uid} {
  allow read: if conSesion() && request.auth.uid == uid;
  allow write: if false;
}
match /accesos/{id} {
  allow create: if conSesion()
    && id.matches(request.auth.uid + '_[0-9]+')
    && request.resource.data.keys().hasOnly(['uid', 'usuario', 'tipo', 'creado', 'leido'])
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.tipo == 'login'
    && request.resource.data.creado == request.time
    && request.resource.data.leido == false
    && request.resource.data.usuario is string
    && request.resource.data.usuario.size() <= 60;
  allow read, delete: if esAdmin();
  allow update: if esAdmin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['leido']);
}
```

Un usuario normal no puede leer `accesos` ni `admins` de otros: la consulta
falla con "permiso denegado" aunque manipule la interfaz.
