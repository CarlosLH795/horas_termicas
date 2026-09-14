# TED-Mx · Monitor térmico

Aplicación Angular independiente para analizar frío y calor histórico por
coordenada. Consume el catálogo de cultivos y el endpoint multimodelo v2.

El dashboard no incluye pronóstico: presenta el mapa del punto, perfil horario
estimado, HF/UF/PF/HFE, grados-hora, región térmica, elevación y procedencia.

## Desarrollo local

```bash
npm install
npm start
```

`npm start` utiliza `proxy.conf.json` y consume `/wrf-api` sin cambiar la API publicada.

## Compilar

```bash
npm run build
```

Para publicarla en una subruta de IIS, por ejemplo `/ted-termico/`:

```bash
npm run build -- --base-href /ted-termico/
```

## Funcionalidades conservadas

- Inicio de sesión y expiración JWT.
- Roles administrador, investigador y usuario.
- Administración de usuarios para administradores.
- Selección y guardado de puntos desde Leaflet.
- Pronóstico WRF de cinco días.
- Página Acerca de.

## Dashboard térmico

- Consulta desde 1990 hasta ayer, con máximo de cinco años por petición.
- Horas frío (≤ 7.2 °C), horas calor (> 10 °C) y grados-hora.
- Calidad diaria: observado, interpolado, provisional o sin dato.
- Exportación PNG, CSV y PDF para roles autorizados.
