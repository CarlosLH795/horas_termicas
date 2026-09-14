import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PuntoGuardado {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  fecha_creacion: string;
}

export interface RespuestaPuntosGuardados {
  total: number;
  limite: number;
  puntos: PuntoGuardado[];
}

export interface CrearPuntoGuardado {
  nombre: string;
  latitud: number;
  longitud: number;
}

export type EstadoDatoTermico = 'observado' | 'interpolado' | 'provisional' | 'sin_dato';

export interface DiaTermico {
  fecha: string;
  tmax?: number;
  tmin?: number;
  weinberger_hf?: number;
  utah_uf?: number;
  dinamico_pf?: number;
  hfe_experimental?: number;
  horas_calor?: number;
  grados_hora_calor?: number;
  acumulados_ciclo?: AcumuladosTermicos;
  fuente_tmax?: string;
  fuente_tmin?: string;
  estado: EstadoDatoTermico;
}

export interface AcumuladosTermicos {
  weinberger_hf: number;
  utah_uf: number;
  dinamico_pf: number;
  hfe_experimental: number;
  horas_calor: number;
  grados_hora_calor: number;
}

export interface CultivoTermico {
  id: number;
  cultivo: string;
  variedad?: string | null;
  temperatura_base_c: number;
  temperatura_maxima_c: number;
  modelo_frio_preferido?: string | null;
  requerimiento_frio_min?: number | null;
  requerimiento_frio_max?: number | null;
  unidad_requerimiento?: string | null;
  fuente_referencia?: string | null;
}

export interface RespuestaHorasTermicas {
  lat: number;
  lon: number;
  fecha_inicio: string;
  fecha_fin: string;
  cultivo_termico: CultivoTermico;
  origen_temperatura: string;
  resolucion_temperatura: string;
  resolucion_elevacion: string;
  metodo_horario: string;
  version_algoritmo: string;
  advertencias: string[];
  estado: { clave: string; nombre: string };
  elevacion_m: number;
  regionalizacion: {
    zona: string;
    modelo_recomendado: string;
    unidad_recomendada: string;
    criterio: string;
    modelo_regional_base: string;
    ajuste_termico: boolean;
    motivo_ajuste?: string | null;
  };
  inicio_ciclo: string;
  resumen: {
    horas_frio_weinberger: number;
    balance_unidades_frio_utah: number;
    porciones_frio_dinamico: number;
    balance_hfe_experimental: number;
    horas_calor: number;
    grados_hora_calor: number;
    nota: string;
  };
  serie: DiaTermico[];
}

@Injectable({
  providedIn: 'root'
})
export class AgroApiService {

  private apiUrl =
    '/wrf-api';

  constructor(
    private http: HttpClient
  ) {}

  getWrfVigente(
    lat: number,
    lon: number
  ): Observable<any> {

    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon);

    return this.http.get(
      `${this.apiUrl}/api/wrf/vigente`,
      { params }
    );
  }

  getGddSerie(
    lat: number,
    lon: number,
    fechaInicio: string,
    fechaFin: string,
    cultivo: 'maiz' | 'frijol' | 'sorgo'
  ): Observable<any> {

    return this.http.get(
      `${this.apiUrl}/api/clima/gdd-serie`,
      {
        params: {
          lat,
          lon,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          cultivo
        }
      }
    );
  }

  getHorasTermicas(
    lat: number,
    lon: number,
    fechaInicio: string,
    fechaFin: string,
    cultivoId: number
  ): Observable<RespuestaHorasTermicas> {
    return this.http.get<RespuestaHorasTermicas>(
      `${this.apiUrl}/api/clima/horas-termicas-v2`,
      {
        params: {
          lat,
          lon,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          cultivo_id: cultivoId
        }
      }
    );
  }

  getCultivosTermicos(): Observable<CultivoTermico[]> {
    return this.http.get<CultivoTermico[]>(
      `${this.apiUrl}/api/clima/cultivos-termicos`
    );
  }

  getHumedadBarra(
    lat: number,
    lon: number,
    profundidadReferencia: string,
    variableHumedad: string
  ): Observable<any> {

    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set(
        'profundidad_referencia',
        profundidadReferencia
      )
      .set(
        'variable_humedad',
        variableHumedad
      );

    return this.http.get(
      `${this.apiUrl}/api/suelo/humedad-barra`,
      { params }
    );
  }

  // =====================================================
  // PUNTOS GUARDADOS
  // =====================================================

  getPuntosGuardados():
    Observable<RespuestaPuntosGuardados> {

    return this.http.get<RespuestaPuntosGuardados>(
      `${this.apiUrl}/api/puntos-guardados`
    );
  }

  crearPuntoGuardado(
    datos: CrearPuntoGuardado
  ): Observable<PuntoGuardado> {

    return this.http.post<PuntoGuardado>(
      `${this.apiUrl}/api/puntos-guardados`,
      datos
    );
  }

  renombrarPuntoGuardado(
    puntoId: number,
    nombre: string
  ): Observable<PuntoGuardado> {

    return this.http.put<PuntoGuardado>(
      `${this.apiUrl}/api/puntos-guardados/${puntoId}`,
      { nombre }
    );
  }

  eliminarPuntoGuardado(
    puntoId: number
  ): Observable<{
    id: number;
    mensaje: string;
  }> {

    return this.http.delete<{
      id: number;
      mensaje: string;
    }>(
      `${this.apiUrl}/api/puntos-guardados/${puntoId}`
    );
  }
}
