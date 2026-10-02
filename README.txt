BOTONERA MUSEO + SPOTIFY PREMIUM - V3.2
=======================================

NOVEDADES V3.2
---------------
- Volumen de fondo independiente y persistente.
- Cada botón programable tiene su propio volumen (0 a 100%).
- Volumen predeterminado para nuevas escenas configurable en Configuración.
- Al disparar una escena, la transición baja el fondo y hace entrar la escena al volumen guardado.
- Al tocar "Volver a la música de fondo", vuelve suavemente al volumen de fondo.
- El botón "Volver a la música de fondo" ahora está junto a las escenas programadas.
- Los botones viejos que no tenían volumen usan el volumen predeterminado de escenas.
- Mantiene búsqueda desde el celular, inicio por segundo exacto, final automático, fade, backup y VOL+ / VOL- físicos en la app Android.

VOLUMEN DE FONDO
----------------
El control "Volumen de fondo" pertenece solamente a la música ambiente.
Se guarda automáticamente. Por defecto queda en 60%.

VOLUMEN DE ESCENAS
------------------
Al crear o editar un botón aparece "Volumen de esta escena". Cada escena puede
tener un valor diferente. Por defecto las nuevas escenas usan 90%, configurable
desde Configuración > Volumen predeterminado de escenas.

EJEMPLO
-------
Fondo: 55%
Entrada de la tía: 85%
Policía: 95%
Escena emotiva: 75%

La transición hace fade-out del audio actual, cambia la canción y hace fade-in
hasta el volumen correspondiente. Spotify controla un solo stream, por lo que
no hay mezcla simultánea de dos canciones como en una consola DJ.

BOTÓN VOLVER AL FONDO
---------------------
Ahora aparece justo arriba de la grilla de escenas. Retoma la canción de ambiente
donde estaba antes de disparar la primera escena y vuelve al volumen de fondo.

BACKUP
------
Exportar/Importar conserva escenas, volumen individual, música de fondo, volumen
de fondo y configuración. Los backups antiguos siguen siendo compatibles.

PUBLICAR EN RENDER
------------------
Reemplazá en GitHub todos los archivos del sitio por los de esta carpeta y hacé
Commit. Render actualizará automáticamente el Static Site.

No hace falta recompilar la app Android para estos cambios: la app abre la misma
página publicada en Render. Si Android conserva una versión vieja, cerrá la app
por completo y volvé a abrirla después del deploy.
