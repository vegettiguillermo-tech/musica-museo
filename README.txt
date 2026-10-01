BOTONERA MUSEO + SPOTIFY PREMIUM
================================

Qué hace
--------
- Controla Spotify de la notebook desde el navegador del celular.
- Música de fondo: Play/Pausa, anterior, siguiente, aleatorio, volumen y playlist/álbum/artista.
- Buscador de canciones.
- Botones de escenas ilimitados.
- Cada escena guarda canción + segundo exacto de inicio.
- Durante el ensayo: poné Spotify en el punto exacto y usá "Capturar lo que está sonando ahora".
- Inicio y final opcionales, con corte automático y fade de salida.
- "Volver al fondo" restaura la música que estaba sonando antes de disparar una escena.
- Los botones quedan guardados en el teléfono.
- Backup JSON para exportar/importar escenas.
- Instalable como PWA desde el navegador.

IMPORTANTE
----------
La página debe estar publicada con HTTPS para que Spotify acepte el Redirect URI.
No necesita Client Secret. Usa OAuth Authorization Code con PKCE.

CONFIGURACIÓN DE SPOTIFY
------------------------
1. Entrá a: https://developer.spotify.com/dashboard
2. Creá una aplicación.
3. Publicá esta carpeta en una URL HTTPS (por ejemplo Render Static Site).
4. Abrí la botonera publicada y entrá a Configuración.
5. Copiá la "Redirect URI" que muestra la botonera.
6. En la app del Spotify Developer Dashboard, agregá ESA URI EXACTA como Redirect URI.
7. Copiá el Client ID de Spotify.
8. Pegalo en Configuración de la botonera y guardá.
9. Tocá "Conectar con Spotify" y autorizá.

PARA USARLA
-----------
1. Abrí Spotify Desktop en la notebook que va al equipo de sonido.
2. Reproducí cualquier canción una vez para que la notebook aparezca como dispositivo activo.
3. Abrí la botonera en el celular.
4. En "Salida de audio" elegí la notebook.
5. En el ensayo, buscá/reproducí un tema, llevalo al segundo exacto y tocá:
   + Agregar botón > Capturar lo que está sonando ahora.
6. Poné el nombre de la escena y Guardar.
7. El día de la función sólo tocás el botón grande de cada escena.

PUBLICAR EN RENDER COMO STATIC SITE
-----------------------------------
Subí estos archivos a un repositorio de GitHub y en Render elegí New > Static Site.
Publish Directory: .
Build Command: dejar vacío.

Si la URL publicada cambia, también debe cambiar el Redirect URI registrado en Spotify.

NOTA DE CONFIABILIDAD
---------------------
La botonera controla Spotify por Internet. Para una función importante conviene probar la misma notebook, celular, Wi-Fi y cuenta Premium durante el ensayo. Si se corta Internet, los comandos remotos de Spotify pueden dejar de responder.
