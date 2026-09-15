import { crearRouter, procedimientoAutenticado, procedimientoPublico } from '../trpc';
import { routerParametro } from './parametro';
import { routerUsuario } from './usuario';
import { routerServicio } from './servicio';
import { routerTarifa } from './tarifa';
import { routerInstalacion } from './instalacion';
import { routerCliente } from './cliente';
import { routerAlumno } from './alumno';
import { routerCaballo } from './caballo';
import { routerContrato } from './contrato';
import { routerCuentaCorriente } from './cuentaCorriente';
import { routerPago } from './pago';
import { routerIdentidadFiscal } from './identidadFiscal';
import { routerPuntoVenta } from './puntoVenta';
import { routerComprobante } from './comprobante';
import { routerPlantillaMensaje } from './plantillaMensaje';
import { routerMensaje } from './mensaje';
import { routerClase } from './clase';
import { routerInscripcion } from './inscripcion';
import { routerAsistencia } from './asistencia';
import { routerPlanAlimentario } from './planAlimentario';
import { routerRegistroCuidado } from './registroCuidado';
import { routerEventoSanitario } from './eventoSanitario';
import { routerInsumo } from './insumo';
import { routerProveedor } from './proveedor';
import { routerOrdenCompra } from './ordenCompra';
import { routerPanel } from './panel';
import { routerPortal } from './portal';
import { routerEvento } from './evento';
import { alcanceDe } from '@/lib/roles';

/**
 * Router raíz.
 *
 * Se arma por módulo y en el orden de prioridad del cronograma. Hoy está M1
 * (acceso, usuarios y configuración); los siguientes se enganchan acá a medida
 * que se construyen.
 */
export const routerApp = crearRouter({
  /** Comprobación de vida. No toca la base ni exige sesión. */
  salud: procedimientoPublico.query(() => ({ ok: true as const })),

  /**
   * Identidad y alcance del usuario actual.
   *
   * Lo consume la navegación para no dibujar accesos que después van a dar
   * `FORBIDDEN`. El alcance sale de la misma tabla que usan los guardas, así que
   * lo que se muestra y lo que se permite no pueden discrepar.
   */
  quienSoy: procedimientoAutenticado.query(async ({ ctx }) => {
    const { data: persona } = await ctx.supabase
      .from('persona')
      .select('nombre, apellido')
      .eq('id', ctx.sesion.personaId)
      .maybeSingle();

    return {
      usuarioId: ctx.sesion.usuarioId,
      personaId: ctx.sesion.personaId,
      rol: ctx.sesion.rol,
      areas: alcanceDe(ctx.sesion.rol),
      nombre: persona?.nombre ?? null,
      apellido: persona?.apellido ?? null,
    };
  }),

  // --- M1 ---
  parametro: routerParametro,
  usuario: routerUsuario,
  servicio: routerServicio,
  tarifa: routerTarifa,
  instalacion: routerInstalacion,

  // --- M2 ---
  cliente: routerCliente,
  alumno: routerAlumno,
  caballo: routerCaballo,
  contrato: routerContrato,

  // --- M3 ---
  cuentaCorriente: routerCuentaCorriente,

  // --- M4 ---
  pago: routerPago,

  // --- M5 ---
  plantillaMensaje: routerPlantillaMensaje,
  mensaje: routerMensaje,

  // --- M6 ---
  identidadFiscal: routerIdentidadFiscal,
  puntoVenta: routerPuntoVenta,
  comprobante: routerComprobante,

  // --- M7 ---
  clase: routerClase,
  inscripcion: routerInscripcion,

  // --- M8 ---
  asistencia: routerAsistencia,

  // --- M9 ---
  planAlimentario: routerPlanAlimentario,
  registroCuidado: routerRegistroCuidado,
  eventoSanitario: routerEventoSanitario,

  // --- M10 ---
  insumo: routerInsumo,
  proveedor: routerProveedor,
  ordenCompra: routerOrdenCompra,

  // --- M11 ---
  panel: routerPanel,

  // --- M13 ---
  portal: routerPortal,

  // --- M15 ---
  evento: routerEvento,
});

export type RouterApp = typeof routerApp;
