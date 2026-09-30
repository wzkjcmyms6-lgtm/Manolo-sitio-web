# Reglas de Firestore para Manolo (con el Feed de Ejercicio)

Pega esto en **Firebase → Firestore Database → Reglas** y toca **Publicar**.

Qué permiten:

- **Tus datos privados** (`users/{tu uid}/...`): solo tú, como siempre.
- **Feed** (`feed`): cualquier usuario con sesión iniciada puede leerlo. Cada
  uno solo puede publicar, cambiar o borrar **sus propias** sesiones. En las
  sesiones de otros solo puede poner o quitar **su propio** me gusta y
  sumar/restar 1 al contador de comentarios.
- **Comentarios**: cualquiera con sesión puede leer y comentar (máximo 500
  caracteres, a su nombre). Borra un comentario quien lo escribió o el dueño
  de la sesión.
- Sin sesión iniciada no se puede leer ni escribir nada.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function conSesion() {
      return request.auth != null;
    }

    // Datos privados de cada usuario (hábitos, finanzas, entrenamientos...).
    match /users/{uid}/{document=**} {
      allow read, write: if conSesion() && request.auth.uid == uid;
    }

    // Feed de Ejercicio.
    match /feed/{postId} {
      allow read: if conSesion();

      allow create: if conSesion()
        && request.resource.data.uid == request.auth.uid
        && postId.matches(request.auth.uid + '_.+');

      allow delete: if conSesion() && resource.data.uid == request.auth.uid;

      allow update: if conSesion() && (
        // El dueño cambia su sesión (no puede pasársela a otro).
        (resource.data.uid == request.auth.uid && request.resource.data.uid == request.auth.uid)
        // Otro usuario: solo su propio me gusta...
        || soloMiLike()
        // ...o el contador de comentarios de a uno.
        || soloContador()
      );

      function soloMiLike() {
        let antes = resource.data.get('likes', []).toSet();
        let despues = request.resource.data.get('likes', []).toSet();
        return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likes'])
          && despues.difference(antes).union(antes.difference(despues)).hasOnly([request.auth.uid]);
      }

      function soloContador() {
        let a = resource.data.get('nComentarios', 0);
        let b = request.resource.data.get('nComentarios', 0);
        return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nComentarios'])
          && (b == a + 1 || b == a - 1) && b >= 0;
      }

      match /comentarios/{comentarioId} {
        allow read: if conSesion();
        allow create: if conSesion()
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.texto is string
          && request.resource.data.texto.size() > 0
          && request.resource.data.texto.size() <= 500;
        allow delete: if conSesion() && (
          resource.data.uid == request.auth.uid
          || get(/databases/$(database)/documents/feed/$(postId)).data.uid == request.auth.uid
        );
      }
    }
  }
}
```

## Antes de pegarlas

Mira las reglas que tienes ahora. Si solo tienen el bloque de
`/users/{...}` (cada uno lee y escribe su carpeta), puedes reemplazarlas
completas por las de arriba. Si ves otra cosa distinta, no las reemplaces:
avísale a quien mantiene la app para juntarlas.
