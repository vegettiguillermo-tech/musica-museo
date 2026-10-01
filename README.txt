BOTONERA MUSEO + SPOTIFY PREMIUM - V3
=====================================

NOVEDADES V3
------------
- Buscar canciones de Spotify directamente dentro de "+ Agregar botón" desde el celular.
- Resultados con tapa, título, artista y duración.
- Transición configurable al cambiar de tema: baja el anterior y hace entrar el nuevo suavemente.
- Transición individual por botón de escena (0 a 8 segundos).
- Transición general configurable para fondo, siguiente/anterior y canciones buscadas.
- Soporte para VOL+ / VOL- desde la app Android Botonera Museo.
- Paso de volumen físico configurable (por defecto 5%).
- Mantiene captura de canción + segundo exacto, final automático y fade de salida.
- Mantiene Volver al fondo, backup e instalación PWA.

IMPORTANTE SOBRE LAS TRANSICIONES
---------------------------------
Spotify Web API controla un solo stream en el dispositivo. La transición de esta
botonera es un fade suave: baja el tema actual, cambia de pista y sube el nuevo.
No mezcla dos pistas simultáneamente como una consola de DJ.

BUSCAR UN TEMA AL CREAR UN BOTÓN
--------------------------------
1. Tocá + Agregar botón.
2. Escribí canción o artista en "Buscar tema en Spotify desde el celular".
3. Tocá Buscar.
4. Tocá Elegir en el resultado correcto.
5. Definí minuto/segundo inicial o usá Capturar lo que está sonando ahora.
6. Elegí la transición de entrada.
7. Guardá.

BOTONES FÍSICOS DE VOLUMEN
--------------------------
Una página web/PWA normal no puede capturar de forma confiable VOL+ / VOL- del
Android para enviarlos al Spotify remoto. La V3 incluye el soporte JavaScript y
se acompaña con un pequeño proyecto Android que abre esta misma página y captura
los botones físicos.

Desde Configuración > Paso de VOL+ / VOL- elegís cuántos puntos cambia cada toque.

CONFIGURACIÓN DE SPOTIFY
------------------------
- Requiere Spotify Premium para los controles remotos usados por la botonera.
- Usa OAuth Authorization Code con PKCE.
- No necesita Client Secret.
- Redirect URI actual esperado: https://musica-museo.onrender.com/

PUBLICAR EN RENDER
------------------
Reemplazá en GitHub los archivos del sitio por los de esta carpeta y hacé Commit.
Render actualizará automáticamente el Static Site.

Publish Directory: .
Build Command: vacío.

Los botones, Client ID y configuración existentes siguen guardados en localStorage
del navegador. Actualizar los archivos del sitio no debería borrarlos.
