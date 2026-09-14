# Guía de prueba y publicación

## Qué es este proyecto

Es una aplicación Angular separada del dashboard WRF-Agro original. Comparte la
misma API, usuarios, roles y puntos guardados, pero tiene su propio frontend y
dashboard térmico.

## Probar localmente

Desde la carpeta del proyecto:

```powershell
npm install
npm start
```

Abrir `http://localhost:4200`. El comando usa `proxy.conf.json`, por lo que las
peticiones `/wrf-api` se envían al servidor publicado.

Flujo de prueba:

1. Iniciar sesión.
2. Seleccionar un punto en el mapa.
3. Abrir **Ver análisis térmico**.
4. Cambiar el rango histórico y pulsar **Actualizar**.
5. Confirmar tarjetas, gráfica, estados y descargas.
6. Probar un punto guardado y la administración de usuarios.

## Generar publicación independiente

```powershell
npm run build -- --base-href /ted-termico/
```

El resultado estará en `dist/ted-termico/browser`.

## Publicar en IIS sin sustituir WRF-Agro

1. Crear `C:\inetpub\wwwroot\ted-termico`.
2. Copiar dentro el contenido de `dist\ted-termico\browser`.
3. En IIS, dentro del sitio `clima.inifap.gob.mx`, convertir `ted-termico` en
   aplicación o dejarlo como subcarpeta del sitio.
4. Comprobar que el módulo **URL Rewrite** esté habilitado.
5. Abrir `https://clima.inifap.gob.mx/ted-termico/`.

La aplicación consume la API existente en `/wrf-api`; no requiere otra API ni
otra tabla de usuarios. El `web.config` incluido resuelve las rutas internas de
Angular al actualizar el navegador.

## Actualizaciones posteriores

Volver a compilar y sustituir únicamente el contenido publicado de
`ted-termico`. La API principal continúa administrándose con:

```bash
sudo systemctl restart wrf-agro-api
sudo systemctl status wrf-agro-api --no-pager
sudo journalctl -u wrf-agro-api -n 100 --no-pager
```
