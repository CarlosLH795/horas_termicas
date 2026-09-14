import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { forkJoin, timeout } from 'rxjs';
import * as L from 'leaflet';
import jsPDF from 'jspdf';
import { Navbar } from '../navbar/navbar';
import {
  AgroApiService,
  CultivoTermico,
  DiaTermico,
  RespuestaHorasTermicas,
} from '../services/agro-api.services';
import { AuthService } from '../services/auth.services';

type ModeloVista = 'automatico' | 'weinberger' | 'utah' | 'dinamico' | 'hfe';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, DecimalPipe, FormsModule, BaseChartDirective, Navbar],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('accumChart') accumChart?: BaseChartDirective;
  readonly authService = inject(AuthService);
  lat = 0;
  lon = 0;
  fechaMinima = '1990-01-01';
  fechaMaxima = this.fechaAyer();
  fechaInicio = this.fechaHaceDias(30);
  fechaFin = this.fechaMaxima;
  cultivoId = 1;
  temperaturaBase = 10;
  temperaturaMaxima = 35;
  modeloVista: ModeloVista = 'automatico';
  cultivos: CultivoTermico[] = [];
  respuesta: RespuestaHorasTermicas | null = null;
  serie: DiaTermico[] = [];
  cargando = true;
  error = '';
  mostrarExplicacionFrio = false;
  mostrarExplicacionCalor = false;
  private mapa?: L.Map;

  accumData: ChartData<'line'> = { labels: [], datasets: [] };
  accumOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } },
    scales: {
      x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 10 } },
      y: { title: { display: true, text: 'Métrica recomendada' } },
      yHeat: {
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Horas calor' },
      },
    },
  };

  constructor(
    private router: Router,
    private api: AgroApiService,
    private cdr: ChangeDetectorRef,
  ) {}
  ngOnInit(): void {
    this.lat = Number(localStorage.getItem('lat'));
    this.lon = Number(localStorage.getItem('lon'));
    if (!Number.isFinite(this.lat) || !Number.isFinite(this.lon) || (!this.lat && !this.lon)) {
      this.router.navigate(['/']);
      return;
    }
    this.cargarTodo();
  }
  ngAfterViewInit(): void {
    setTimeout(() => this.crearMapa(), 0);
  }
  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  cargarTodo(): void {
    this.cargando = true;
    this.error = '';
    forkJoin({
      cultivos: this.api.getCultivosTermicos().pipe(timeout(30000)),
      termico: this.api
        .getHorasTermicas(
          this.lat, this.lon, this.fechaInicio, this.fechaFin, this.cultivoId,
          this.temperaturaBase, this.temperaturaMaxima,
        )
        .pipe(timeout(120000)),
    }).subscribe({
      next: ({ cultivos, termico }) => {
        this.cultivos = cultivos;
        const cultivo = cultivos.find((x) => x.id === Number(this.cultivoId));
        if (cultivo) {
          this.temperaturaBase = cultivo.temperatura_base_c;
          this.temperaturaMaxima = cultivo.temperatura_maxima_c;
        }
        this.aplicarRespuesta(termico);
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = this.mensajeError(e);
        this.cargando = false;
      },
    });
  }
  consultar(): void {
    if (this.fechaInicio > this.fechaFin) {
      this.error = 'La fecha inicial no puede ser posterior a la final.';
      return;
    }
    if (this.diferenciaDias(this.fechaInicio, this.fechaFin) + 1 > 366) {
      this.error = 'El periodo máximo es de 366 días.';
      return;
    }
    if (!Number.isFinite(this.temperaturaBase) || !Number.isFinite(this.temperaturaMaxima)) {
      this.error = 'Las temperaturas base y máxima deben ser números válidos.';
      return;
    }
    if (this.temperaturaMaxima <= this.temperaturaBase) {
      this.error = 'La temperatura máxima debe ser mayor que la temperatura base.';
      return;
    }
    this.cargando = true;
    this.error = '';
    this.api
      .getHorasTermicas(
        this.lat, this.lon, this.fechaInicio, this.fechaFin, this.cultivoId,
        this.temperaturaBase, this.temperaturaMaxima,
      )
      .pipe(timeout(120000))
      .subscribe({
        next: (r) => {
          this.aplicarRespuesta(r);
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (e) => {
          this.error = this.mensajeError(e);
          this.cargando = false;
        },
      });
  }
  private aplicarRespuesta(r: RespuestaHorasTermicas): void {
    this.respuesta = r;
    this.serie = r.serie.filter((x) => x.estado !== 'sin_dato');
    this.crearGraficaAcumulada();
  }

  private crearMapa(): void {
    const nodo = document.getElementById('mini-map');
    if (!nodo || this.mapa) return;
    this.mapa = L.map(nodo, { zoomControl: true, minZoom: 5, maxZoom: 19 }).setView(
      [this.lat, this.lon],
      17,
    );
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imágenes © Esri' },
    ).addTo(this.mapa);
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Límites y nombres © Esri' },
    ).addTo(this.mapa);
    L.circleMarker([this.lat, this.lon], {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#00a8d6',
      fillOpacity: 1,
    }).addTo(this.mapa);
  }
  crearGraficaAcumulada(): void {
  this.accumData = {
    labels: this.serie.map((dia) => this.fechaCorta(dia.fecha)),
    datasets: [
      {
        label: 'Horas Frío acumuladas (Weinberger)',
        data: this.serie.map((dia) =>
          Number(
            dia.acumulados_periodo?.weinberger_hf ??
            dia.acumulados_ciclo?.weinberger_hf ??
            0
          )
        ),
        borderColor: '#11a7aa',
        backgroundColor: '#11a7aa',
        pointRadius: 0,
        borderWidth: 3,
        tension: 0.15,
      },
      {
        label: 'Horas calor acumuladas',
        data: this.serie.map(
          (dia) =>
            dia.acumulados_periodo?.horas_calor ??
            dia.acumulados_ciclo?.horas_calor ??
            0
        ),
        borderColor: '#ff7a2b',
        backgroundColor: '#ff7a2b',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.15,
        yAxisID: 'yHeat',
      },
    ],
  };

  setTimeout(() => this.accumChart?.update(), 0);
}
  alCambiarModelo(): void {
    this.crearGraficaAcumulada();
  }
  alCambiarCultivo(): void {
    const cultivo = this.cultivoSeleccionado;
    if (!cultivo) return;
    this.temperaturaBase = cultivo.temperatura_base_c;
    this.temperaturaMaxima = cultivo.temperatura_maxima_c;
  }
  get cultivoSeleccionado(): CultivoTermico | undefined {
    return this.cultivos.find((x) => x.id === Number(this.cultivoId));
  }
  get descripcionOrigenTemperatura(): string {
  const origen = this.respuesta?.origen_temperatura;

  switch (origen) {
    case 'wrf_horario':
      return 'Datos horarios WRF interpolados a 1 km y corregidos por elevación.';

    case 'mixto_wrf_horario_y_tmin_tmax':
      return 'Serie mixta: datos horarios WRF con respaldo de Tmin/Tmax diarias.';

    case 'tmin_tmax_diarias':
      return 'Reconstrucción horaria desde temperaturas mínimas y máximas diarias.';

    default:
      return 'Análisis histórico de frío y calor con datos térmicos disponibles.';
  }
}
  get resumen() {
    return this.respuesta?.resumen;
  }
  get recomendacion() {
    return this.respuesta?.regionalizacion;
  }
  modeloEfectivo(): Exclude<ModeloVista, 'automatico'> {
    return (
      ((this.modeloVista === 'automatico'
        ? this.recomendacion?.modelo_recomendado
        : this.modeloVista) as Exclude<ModeloVista, 'automatico'>) || 'dinamico'
    );
  }
  get valorFrioPrincipal(): number {
    const r = this.resumen;
    if (!r) return 0;
    return (
      (
        {
          weinberger: r.horas_frio_weinberger,
          utah: r.balance_unidades_frio_utah,
          dinamico: r.porciones_frio_dinamico,
          hfe: r.balance_hfe_experimental,
        } as any
      )[this.modeloEfectivo()] ?? 0
    );
  }
  get etiquetaFrioPrincipal(): string {
    return (
      {
        weinberger: 'Horas Frío',
        utah: 'Balance Utah',
        dinamico: 'Porciones de Frío',
        hfe: 'Balance HFE experimental',
      } as any
    )[this.modeloEfectivo()];
  }
  get unidadFrioPrincipal(): string {
    return ({ weinberger: 'HF', utah: 'UF', dinamico: 'PF', hfe: 'HFE' } as any)[
      this.modeloEfectivo()
    ];
  }
  get explicacionResultadoFrio(): string {
    const hf = this.resumen?.horas_frio_weinberger ?? 0;
    const valor = this.valorFrioPrincipal;
    switch (this.modeloEfectivo()) {
      case 'weinberger':
        return `El resultado es ${valor.toFixed(1)} HF porque la reconstrucción horaria encontró esa cantidad de horas con temperatura igual o menor a 7.2 °C. Este método cuenta horas y no descuenta el efecto de temperaturas cálidas.`;
      case 'utah':
        return valor < 0
          ? `El balance es ${valor.toFixed(1)} UF porque las horas cálidas recibieron ponderaciones negativas y superaron a las horas con frío efectivo. No son horas frío negativas: es un balance térmico. En el mismo periodo sí se estimaron ${hf.toFixed(1)} HF simples.`
          : `El balance es ${valor.toFixed(1)} UF después de sumar las horas frías con diferente peso y restar el efecto de las horas cálidas. En el periodo también se estimaron ${hf.toFixed(1)} HF simples.`;
      case 'dinamico':
        return valor <= 0
          ? `El resultado es 0 PF porque, aunque se estimaron ${hf.toFixed(1)} HF simples, la secuencia de temperaturas no logró consolidar el intermediario de frío en una porción estable según el Modelo Dinámico. El calor entre episodios fríos puede deshacer ese intermediario; las ${hf.toFixed(1)} HF existieron, pero no equivalen automáticamente a porciones de frío.`
          : `El resultado es ${valor.toFixed(2)} PF porque la secuencia horaria logró transformar el frío intermedio en porciones estables. También se estimaron ${hf.toFixed(1)} HF simples, pero HF y PF son unidades diferentes.`;
      case 'hfe':
        return valor < 0
          ? `El balance es ${valor.toFixed(1)} HFE porque las horas con 25 °C o más, que restan una unidad, superaron a las horas entre 0 y 10 °C, que suman una. No representa horas frío negativas.`
          : `El balance es ${valor.toFixed(1)} HFE: suma una unidad por cada hora entre 0 y 10 °C y resta una por cada hora con 25 °C o más. Este indicador continúa marcado como experimental.`;
    }
    return '';
  }
  get explicacionResultadoCalor(): string {
    const horas = this.resumen?.horas_calor ?? 0;
    const gradosHora = this.resumen?.grados_hora_calor ?? 0;
    const gradosDia = this.resumen?.grados_dia ?? gradosHora / 24;

    return `En el periodo seleccionado hubo ${horas.toFixed(1)} horas con temperatura superior a la base de ${this.temperaturaBase.toFixed(1)} °C. Los ${gradosHora.toFixed(2)} grados-hora representan la suma, hora por hora, de cuánto superó la temperatura esa base. La temperatura utilizada se limita a ${this.temperaturaMaxima.toFixed(1)} °C. Al dividir los grados-hora entre 24 se obtienen ${gradosDia.toFixed(3)} grados-día.`;
  }
  get interpolados(): number {
    return this.serie.filter((x) => x.estado === 'interpolado').length;
  }
  volverMapa(): void {
    this.router.navigate(['/']);
  }
  descargarCSV(): void {
    const c = [
      'fecha',
      'tmax',
      'tmin',
      'weinberger_hf',
      'utah_uf',
      'dinamico_pf',
      'hfe',
      'horas_calor',
      'grados_hora_calor',
      'estado',
    ];
    const f = this.serie.map((x) =>
      [
        x.fecha,
        x.tmax,
        x.tmin,
        x.weinberger_hf,
        x.utah_uf,
        x.dinamico_pf,
        x.hfe_experimental,
        x.horas_calor,
        x.grados_hora_calor,
        x.estado,
      ].join(','),
    );
    this.descargarBlob(
      [c.join(','), ...f].join('\n'),
      `analisis-termico_${this.fechaInicio}_${this.fechaFin}.csv`,
      'text/csv;charset=utf-8',
    );
  }
  descargarPNG(): void {
    const c = this.accumChart?.chart?.canvas;
    if (!c) return;
    const a = document.createElement('a');
    a.download = 'acumulados-termicos.png';
    a.href = c.toDataURL('image/png');
    a.click();
  }
  descargarPDF(): void {
    if (!this.respuesta) return;
    const p = new jsPDF({ orientation: 'landscape' });
    p.setFontSize(17);
    p.text('Consulta agroclimática térmica', 14, 17);
    p.setFontSize(10);
    p.text(
      `Punto: ${this.lat.toFixed(4)}, ${this.lon.toFixed(4)} · ${this.respuesta.estado.nombre} · ${this.respuesta.elevacion_m} m`,
      14,
      26,
    );
    p.text(
      `${this.etiquetaFrioPrincipal}: ${this.valorFrioPrincipal} ${this.unidadFrioPrincipal}`,
      14,
      34,
    );
    p.text(`Grados-hora de calor: ${this.resumen?.grados_hora_calor ?? 0}`, 14, 41);
    const c = this.accumChart?.chart?.canvas;
    if (c) p.addImage(c.toDataURL('image/png'), 'PNG', 75, 18, 205, 92);
    p.save('consulta-agroclimatica.pdf');
  }
  private descargarBlob(c: string, n: string, t: string): void {
    const u = URL.createObjectURL(new Blob([c], { type: t }));
    const a = document.createElement('a');
    a.href = u;
    a.download = n;
    a.click();
    URL.revokeObjectURL(u);
  }
  private fechaAyer(): string {
    const f = new Date();
    f.setDate(f.getDate() - 1);
    return this.fechaInput(f);
  }
  private fechaHaceDias(dias: number): string {
    const f = new Date();
    f.setDate(f.getDate() - dias);
    return this.fechaInput(f);
  }
  private fechaInput(f: Date): string {
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }
  private fechaCorta(v: string): string {
    const [, m, d] = v.split('-');
    return `${d}/${m}`;
  }
  private diferenciaDias(i: string, f: string): number {
    return Math.floor((Date.parse(`${f}T12:00:00`) - Date.parse(`${i}T12:00:00`)) / 86400000);
  }
  private mensajeError(e: any): string {
    return e?.error?.detail ?? 'No fue posible completar la consulta térmica.';
  }
}
