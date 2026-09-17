/**
 * RIENDA · Datos de demostración del Haras Las Lechuzas.
 *
 * Arma un establecimiento completo y coherente para poder recorrer M1 a M10 con
 * algo real adelante: instalaciones, personal, clientes, alumnos, caballos,
 * contratos, tarifas versionadas, cuentas corrientes con la cartera en los tres
 * estados del semáforo, tres meses y medio de clases dictadas con su asistencia
 * y dos semanas programadas hacia adelante.
 *
 * Los nombres son los del prototipo, que a su vez salieron del relevamiento, de
 * modo que lo que se ve en pantalla coincide con lo que dicen los documentos de
 * diseño.
 *
 * Es re-ejecutable: limpia antes de sembrar.
 *
 * NO siembra dos cosas, a propósito:
 *
 *   * **Comprobantes.** Un CAE inventado es un documento legal falso. M6 emite
 *     de verdad contra homologación desde su pantalla; ése es el ensayo.
 *   * **Mensajes.** Las plantillas están en `borrador` y sin aprobar por Meta:
 *     un envío hoy fallaría. Es el estado real de la dependencia externa.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const HOY = '2026-09-05';
const ZONA = '-03:00';
/** Instante UTC que corresponde a una hora de pared del haras. */
const enFunes = (fecha, hora) => new Date(`${fecha}T${hora}:00${ZONA}`).toISOString();

function revisar(etiqueta, { data, error }) {
  if (error) {
    console.error(`FALLO en ${etiqueta}:`, error.message);
    process.exit(1);
  }
  return data;
}

/**
 * PostgREST completa con `null` las claves que a una fila del lote le faltan
 * respecto de las demás, así que el valor por omisión de la base no se aplica:
 * se pisa con nulo. Por eso cada `insert` de varias filas las arma con un
 * constructor que fija el mismo juego de claves para todas.
 */
const insertar = async (tabla, filas, etiqueta = tabla) =>
  revisar(etiqueta, await db.from(tabla).insert(filas).select());

const uno = async (tabla, fila, etiqueta = tabla) =>
  revisar(etiqueta, await db.from(tabla).insert(fila).select().single());

// -----------------------------------------------------------------------------
// 0 · Limpieza
//
// Se conservan `parametro`, `servicio` y `plantilla_mensaje`, que los sembró la
// migración de configuración inicial, y la identidad fiscal con su punto de
// venta, que llevan el CUIT real con el que M6 emite contra homologación.
// `auditoria` no se toca: una regla impide borrarla, y está bien que la tenga.
//
// Por la misma razón, ningún `usuario` que la auditoría referencie se puede
// borrar tampoco (`auditoria_usuario_id_fkey`): cualquier instructor o peón de
// demostración que haya llegado a tocar algo en una corrida anterior queda
// pisado ahí para siempre, no es un caso aislado. En vez de mantener a mano
// una lista de excepciones que se queda vieja, se calcula sola: se protege a
// todo el que la auditoría ya citó, y `crearUsuario`/`crearAccesoParaPersona`
// reutilizan esa persona en lugar de intentar crear una nueva con el mismo
// documento.
// -----------------------------------------------------------------------------
const PROTEGIDOS_FIJOS = [
  '7d93c1c4-4fce-487d-aba6-45ccbd3e1dc3', // Bruno Neirotti, la sesión con la que se entra
  '12614f36-c1aa-46de-b02e-f0ca9b13099c', // usuario inactivo que la auditoría referencia
];

const usuariosAuditados = [
  ...new Set(
    revisar('auditoria', await db.from('auditoria').select('usuario_id').not('usuario_id', 'is', null)).map(
      (a) => a.usuario_id,
    ),
  ),
];
const personasDeAuditados = usuariosAuditados.length
  ? revisar('usuario (auditados)', await db.from('usuario').select('persona_id').in('id', usuariosAuditados)).map(
      (u) => u.persona_id,
    )
  : [];
const PERSONAS_QUE_QUEDAN = [...new Set([...PROTEGIDOS_FIJOS, ...personasDeAuditados])];

for (const tabla of [
  'asistencia', 'inscripcion', 'clase', 'inscripcion_evento', 'evento', 'mensaje',
  'movimiento_cuenta', 'pago', 'comprobante', 'estado_cuenta', 'cuenta_corriente', 'contrato',
  // `detalle_orden_compra` NO se borra por su cuenta: M10 no deja sacarle un
  // renglón a una orden que ya salió, y con razón. Se va por la cascada al
  // borrar la orden, que es el único caso en que quitarlo tiene sentido.
  'movimiento_stock', 'orden_compra', 'proveedor',
  // `plan_alimentario` va antes que `insumo`: el plan nombra de qué existencia
  // sale la ración, así que borrar el insumo primero choca con esa clave ajena.
  'evento_sanitario', 'registro_cuidado', 'plan_alimentario', 'insumo',
  'alumno', 'caballo', 'cliente', 'tarifa', 'instalacion',
]) {
  const { error } = await db.from(tabla).delete().not('id', 'is', null);
  if (error) {
    console.error(`FALLO limpiando ${tabla}:`, error.message);
    process.exit(1);
  }
}
{
  const { error } = await db.from('usuario').delete().not('persona_id', 'in', `(${PERSONAS_QUE_QUEDAN.join(',')})`);
  if (error) {
    console.error('FALLO limpiando usuario:', error.message);
    process.exit(1);
  }
}
{
  const { error } = await db.from('persona').delete().not('id', 'in', `(${PERSONAS_QUE_QUEDAN.join(',')})`);
  if (error) {
    console.error('FALLO limpiando persona:', error.message);
    process.exit(1);
  }
}
console.log('base limpia');

// -----------------------------------------------------------------------------
// 1 · Instalaciones
// -----------------------------------------------------------------------------
const instalaciones = await insertar('instalacion', [
  { nombre: 'Pista A', tipo: 'pista', capacidad: 8 },
  { nombre: 'Pista B', tipo: 'pista', capacidad: 6 },
  { nombre: 'Picadero techado', tipo: 'picadero', capacidad: 4 },
  { nombre: 'Piquete Norte', tipo: 'piquete', capacidad: 6 },
  { nombre: 'Piquete Sur', tipo: 'piquete', capacidad: 6 },
  ...Array.from({ length: 8 }, (_, i) => ({ nombre: `Box ${i + 1}`, tipo: 'box', capacidad: 1 })),
]);
const inst = Object.fromEntries(instalaciones.map((i) => [i.nombre, i.id]));
console.log(`instalaciones: ${instalaciones.length}`);

// -----------------------------------------------------------------------------
// 2 · Personal: un instructor y un peón, con acceso propio
//
// Hacen falta de verdad y no como fila suelta: `clase.instructor_id` apunta a
// `usuario`, y desde M7 el sistema lo opera un rol que no es el dueño.
// -----------------------------------------------------------------------------
/** La cuenta de Auth y la fila de `usuario`, dada una persona ya resuelta. */
async function crearAccesoParaPersona({ personaId, documento, email, rol }) {
  const clave = `Rienda.${documento}`;
  const { data: cuenta, error } = await db.auth.admin.createUser({
    email,
    password: clave,
    email_confirm: true,
  });

  // Al repetir el sembrado la cuenta de Auth ya existe: se reutiliza y se le
  // vuelve a fijar la clave, para que la que se imprime sea siempre la buena.
  let id = cuenta?.user?.id;
  if (error) {
    const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 });
    const previa = lista?.users?.find((u) => u.email === email);
    if (!previa) {
      console.error('FALLO creando la cuenta de', email, error.message);
      process.exit(1);
    }
    await db.auth.admin.updateUserById(previa.id, { password: clave });
    id = previa.id;
  }

  // `upsert` y no `insert`: si esta persona quedó protegida por la auditoría
  // (arriba), su fila de `usuario` sobrevivió a la limpieza y ya existe.
  await revisar('usuario', await db.from('usuario').upsert({ id, persona_id: personaId, rol }, { onConflict: 'id' }));
  console.log(`  ${rol.padEnd(12)} ${email.padEnd(40)} clave: ${clave}`);
  return id;
}

/**
 * Igual que `uno('persona', ...)`, pero por `upsert` sobre `persona_documento_unico`:
 * si el documento ya existe —porque la limpieza no pudo borrarlo, protegido
 * por la auditoría— se actualiza esa fila en lugar de chocar contra la
 * restricción única.
 */
async function unaPersona(datos) {
  return revisar(
    'persona',
    await db
      .from('persona')
      .upsert(datos, { onConflict: 'tipo_documento,numero_documento' })
      .select()
      .single(),
  );
}

async function crearUsuario({ nombre, apellido, documento, email, rol, telefono, nacimiento }) {
  const persona = await unaPersona({
    nombre,
    apellido,
    tipo_documento: 'dni',
    numero_documento: documento,
    fecha_nacimiento: nacimiento,
    telefono,
    email,
    domicilio: 'Funes, Santa Fe',
  });

  return crearAccesoParaPersona({ personaId: persona.id, documento, email, rol });
}

/**
 * El acceso al portal (M13) de un cliente que ya está cargado: no crea una
 * persona nueva, la reutiliza —es exactamente lo que hace ahora
 * `usuario.crear` en el router— así que Marcela y Lucía entran con la misma
 * ficha que ya tienen como clientas, no con un duplicado.
 */
async function crearAccesoDePortal({ personaId, documento, email }) {
  return crearAccesoParaPersona({ personaId, documento, email, rol: 'cliente' });
}

console.log('personal:');
const INSTRUCTOR = await crearUsuario({
  nombre: 'Ramón',
  apellido: 'Ocampo',
  documento: '24518903',
  email: 'ramon.ocampo@haraslaslechuzas.demo',
  rol: 'instructor',
  telefono: '+5493412345678',
  nacimiento: '1975-04-18',
});
const PEON = await crearUsuario({
  nombre: 'Ceferino',
  apellido: 'Duarte',
  documento: '31204776',
  email: 'ceferino.duarte@haraslaslechuzas.demo',
  rol: 'peon',
  telefono: '+5493412345679',
  nacimiento: '1985-11-02',
});

// -----------------------------------------------------------------------------
// 3 · Tarifas versionadas
//
// Dos vigencias por servicio (decisión 1.4): el precio no se pisa, se agrega una
// fila nueva. El aumento de julio es lo que hace visible que los cargos de junio
// se calcularon con el precio de junio.
// -----------------------------------------------------------------------------
const servicios = revisar(
  'servicios',
  await db.from('servicio').select('id, nombre, unidad, aplica_a, modalidad'),
);
const srv = Object.fromEntries(servicios.map((s) => [s.nombre, s]));

const PRECIOS = {
  'Pensión box': [260000, 310000],
  'Pensión piquete': [180000, 215000],
  'Clases escuela': [22000, 26000],
  'Clase personalizada': [35000, 42000],
  Volteo: [20000, 24000],
  Colonia: [90000, 105000],
};

await insertar(
  'tarifa',
  Object.entries(PRECIOS).flatMap(([nombre, [enero, julio]]) => [
    { servicio_id: srv[nombre].id, importe: enero, vigente_desde: '2026-01-01' },
    { servicio_id: srv[nombre].id, importe: julio, vigente_desde: '2026-07-01' },
  ]),
);
console.log(`tarifas: ${Object.keys(PRECIOS).length * 2}`);

/** El precio del servicio a una fecha: la vigencia más reciente que no la supera. */
const precioAl = (nombre, fecha) => (fecha >= '2026-07-01' ? PRECIOS[nombre][1] : PRECIOS[nombre][0]);

// -----------------------------------------------------------------------------
// 4 · Clientes, alumnos y caballos
// -----------------------------------------------------------------------------
const laPersona = (d) => ({
  tipo_documento: 'dni',
  fecha_nacimiento: null,
  telefono: null,
  email: null,
  domicilio: null,
  ...d,
});

// `unaPersona` (upsert) y no `insertar` (insert liso): si Marcela o Lucía
// llegaron a operar el portal (M13) en una corrida anterior, su persona quedó
// protegida por la auditoría y sobrevivió a la limpieza — un insert liso
// chocaría contra `persona_documento_unico` en la primera fila protegida.
const personas = await Promise.all(
  [
    laPersona({ nombre: 'Marcela', apellido: 'Gutiérrez', numero_documento: '27418256', fecha_nacimiento: '1979-06-14', telefono: '+5493413001001', email: 'marcela.gutierrez@correo.demo', domicilio: 'Funes, Santa Fe' }),
    laPersona({ nombre: 'Joaquín', apellido: 'Gutiérrez', numero_documento: '54120887', fecha_nacimiento: '2014-03-22' }),
    laPersona({ nombre: 'Martina', apellido: 'Gutiérrez', numero_documento: '56330214', fecha_nacimiento: '2018-09-30' }),

    laPersona({ nombre: 'Marcelo', apellido: 'Rossi', numero_documento: '25904113', fecha_nacimiento: '1977-01-09', telefono: '+5493413001002', email: 'marcelo.rossi@correo.demo', domicilio: 'Roldán, Santa Fe' }),
    laPersona({ nombre: 'Tomás', apellido: 'Rossi', numero_documento: '52887340', fecha_nacimiento: '2012-07-11' }),
    laPersona({ nombre: 'Valentina', apellido: 'Rossi', numero_documento: '55014992', fecha_nacimiento: '2015-11-25' }),

    laPersona({ nombre: 'Sofía', apellido: 'Ibáñez', numero_documento: '39204551', fecha_nacimiento: '1998-02-17', telefono: '+5493413001003', email: 'sofia.ibanez@correo.demo', domicilio: 'Rosario, Santa Fe' }),
    laPersona({ nombre: 'Lucía', apellido: 'Pereyra', numero_documento: '33871402', fecha_nacimiento: '1992-08-05', telefono: '+5493413001004', email: 'lucia.pereyra@correo.demo', domicilio: 'Funes, Santa Fe' }),
    laPersona({ nombre: 'Alejandro', apellido: 'Domínguez', numero_documento: '22106744', fecha_nacimiento: '1971-12-01', telefono: '+5493413001005', email: 'alejandro.dominguez@correo.demo', domicilio: 'Rosario, Santa Fe' }),
    laPersona({ nombre: 'Elena', apellido: 'Ferrari', numero_documento: '28455901', fecha_nacimiento: '1981-05-19', telefono: '+5493413001006', email: 'contacto@lamedialuna.demo', domicilio: 'Roldán, Santa Fe' }),
  ].map((d) => unaPersona(d)),
);
const per = Object.fromEntries(personas.map((p) => [`${p.nombre} ${p.apellido}`, p.id]));
console.log(`personas: ${personas.length}`);

const elCliente = (d) => ({
  tipo: 'persona_fisica',
  persona_id: null,
  razon_social: null,
  requiere_factura: false,
  cuit: null,
  condicion_iva: null,
  canal_preferido: 'whatsapp',
  dia_vencimiento: 10,
  consentimiento_medio: null,
  ...d,
});

// RN-05: sólo alrededor del 30 % pide factura. Acá, dos de seis.
const clientes = await insertar('cliente', [
  elCliente({ persona_id: per['Marcela Gutiérrez'], consentimiento_en: '2026-02-10T13:00:00Z', consentimiento_medio: 'firma en ficha de inscripción' }),
  elCliente({ persona_id: per['Marcelo Rossi'], requiere_factura: true, cuit: '20259041135', condicion_iva: 'consumidor_final', consentimiento_en: '2026-02-15T13:00:00Z', consentimiento_medio: 'firma en ficha de inscripción' }),
  elCliente({ persona_id: per['Sofía Ibáñez'], dia_vencimiento: 5, consentimiento_en: '2026-03-01T13:00:00Z', consentimiento_medio: 'WhatsApp' }),
  elCliente({ persona_id: per['Lucía Pereyra'], consentimiento_en: '2026-01-20T13:00:00Z', consentimiento_medio: 'WhatsApp' }),
  elCliente({ persona_id: per['Alejandro Domínguez'], dia_vencimiento: 15, consentimiento_en: '2025-11-08T13:00:00Z', consentimiento_medio: 'firma en contrato de pensión' }),
  elCliente({ tipo: 'persona_juridica', razon_social: 'Establecimiento La Media Luna S.R.L.', persona_id: per['Elena Ferrari'], requiere_factura: true, cuit: '30715482913', condicion_iva: 'responsable_inscripto', canal_preferido: 'email', dia_vencimiento: 20, consentimiento_en: '2025-09-12T13:00:00Z', consentimiento_medio: 'contrato marco' }),
]);
const cli = Object.fromEntries(
  clientes.map((c) => [
    c.razon_social ?? personas.find((p) => p.id === c.persona_id).apellido,
    c.id,
  ]),
);
console.log(`clientes: ${clientes.length}`);

// Los menores exigen responsable y consentimiento del tutor (decisión 1.3).
const elAlumno = (d) => ({
  responsable_id: null,
  consentimiento_tutor_en: null,
  observaciones_medicas: null,
  ...d,
});

const alumnos = await insertar('alumno', [
  elAlumno({ persona_id: per['Joaquín Gutiérrez'], cliente_id: cli['Gutiérrez'], responsable_id: per['Marcela Gutiérrez'], consentimiento_tutor_en: '2026-02-10T13:00:00Z', nivel: 'nivel_1' }),
  elAlumno({ persona_id: per['Martina Gutiérrez'], cliente_id: cli['Gutiérrez'], responsable_id: per['Marcela Gutiérrez'], consentimiento_tutor_en: '2026-02-10T13:00:00Z', nivel: 'inicial' }),
  elAlumno({ persona_id: per['Tomás Rossi'], cliente_id: cli['Rossi'], responsable_id: per['Marcelo Rossi'], consentimiento_tutor_en: '2026-02-15T13:00:00Z', nivel: 'nivel_1' }),
  elAlumno({ persona_id: per['Valentina Rossi'], cliente_id: cli['Rossi'], responsable_id: per['Marcelo Rossi'], consentimiento_tutor_en: '2026-02-15T13:00:00Z', nivel: 'nivel_1' }),
  elAlumno({ persona_id: per['Sofía Ibáñez'], cliente_id: cli['Ibáñez'], nivel: 'nivel_2' }),
  elAlumno({ persona_id: per['Lucía Pereyra'], cliente_id: cli['Pereyra'], nivel: 'nivel_3', observaciones_medicas: 'Antecedente de lesión en rodilla izquierda (2024). Evitar saltos de más de 80 cm.' }),
]);
const alu = Object.fromEntries(
  alumnos.map((a) => [Object.keys(per).find((k) => per[k] === a.persona_id), a.id]),
);
console.log(`alumnos: ${alumnos.length}`);

const elCaballo = (d) => ({ propietario_id: null, estado: 'activo', ...d });

// Los cinco primeros son del haras (propietario nulo): son los de escuela.
const caballos = await insertar('caballo', [
  elCaballo({ nombre: 'Gambeta', instalacion_id: inst['Box 1'], raza: 'Criollo', sexo: 'macho_castrado', pelaje: 'zaino', fecha_nacimiento: '2014-10-02', peso_kg: 430.0, fecha_ingreso: '2019-03-01' }),
  elCaballo({ nombre: 'Malbec', instalacion_id: inst['Box 2'], raza: 'Criollo', sexo: 'macho_castrado', pelaje: 'alazán', fecha_nacimiento: '2016-05-18', peso_kg: 445.5, fecha_ingreso: '2020-08-15' }),
  elCaballo({ nombre: 'Lucero', instalacion_id: inst['Box 3'], raza: 'Petiso argentino', sexo: 'macho_castrado', pelaje: 'tordillo', fecha_nacimiento: '2018-01-27', peso_kg: 310.0, fecha_ingreso: '2021-11-05' }),
  elCaballo({ nombre: 'Pampa', instalacion_id: inst['Box 4'], raza: 'Criollo', sexo: 'hembra', pelaje: 'bayo', fecha_nacimiento: '2015-09-09', peso_kg: 420.0, fecha_ingreso: '2019-03-01' }),
  elCaballo({ nombre: 'Nube', instalacion_id: inst['Piquete Norte'], raza: 'Petiso argentino', sexo: 'hembra', pelaje: 'blanco', fecha_nacimiento: '2019-06-14', peso_kg: 295.0, fecha_ingreso: '2023-02-20', estado: 'en_tratamiento' }),

  elCaballo({ nombre: 'Rayo', propietario_id: cli['Establecimiento La Media Luna S.R.L.'], instalacion_id: inst['Box 5'], raza: 'Silla Argentino', sexo: 'macho', pelaje: 'zaino oscuro', fecha_nacimiento: '2017-08-30', peso_kg: 510.0, fecha_ingreso: '2025-09-15' }),
  elCaballo({ nombre: 'Tormenta', propietario_id: cli['Establecimiento La Media Luna S.R.L.'], instalacion_id: inst['Box 6'], raza: 'Silla Argentino', sexo: 'hembra', pelaje: 'negro', fecha_nacimiento: '2018-04-12', peso_kg: 480.0, fecha_ingreso: '2025-09-15' }),
  elCaballo({ nombre: 'Sultán', propietario_id: cli['Domínguez'], instalacion_id: inst['Box 7'], raza: 'Árabe', sexo: 'macho_castrado', pelaje: 'tordillo', fecha_nacimiento: '2013-02-03', peso_kg: 465.0, fecha_ingreso: '2025-11-10' }),
  elCaballo({ nombre: 'Aurora', propietario_id: cli['Pereyra'], instalacion_id: inst['Piquete Sur'], raza: 'Criollo', sexo: 'hembra', pelaje: 'overo', fecha_nacimiento: '2019-11-21', peso_kg: 410.0, fecha_ingreso: '2026-01-20' }),
]);
const cab = Object.fromEntries(caballos.map((c) => [c.nombre, c.id]));
console.log(`caballos: ${caballos.length}`);

// -----------------------------------------------------------------------------
// 5 · Contratos
//
// El servicio decide si el contrato cuelga de un caballo o de un alumno, y el
// disparador `validar_objeto_del_contrato` lo verifica.
// -----------------------------------------------------------------------------
const elContrato = (d) => ({
  caballo_id: null,
  alumno_id: null,
  fecha_fin: null,
  importe_pactado: null,
  estado: 'vigente',
  ...d,
});

const contratos = await insertar('contrato', [
  elContrato({ cliente_id: cli['Establecimiento La Media Luna S.R.L.'], servicio_id: srv['Pensión box'].id, caballo_id: cab['Rayo'], fecha_inicio: '2025-09-15' }),
  elContrato({ cliente_id: cli['Establecimiento La Media Luna S.R.L.'], servicio_id: srv['Pensión box'].id, caballo_id: cab['Tormenta'], fecha_inicio: '2025-09-15' }),
  elContrato({ cliente_id: cli['Domínguez'], servicio_id: srv['Pensión box'].id, caballo_id: cab['Sultán'], fecha_inicio: '2025-11-10' }),
  elContrato({ cliente_id: cli['Pereyra'], servicio_id: srv['Pensión piquete'].id, caballo_id: cab['Aurora'], fecha_inicio: '2026-01-20' }),

  elContrato({ cliente_id: cli['Gutiérrez'], servicio_id: srv['Clases escuela'].id, alumno_id: alu['Joaquín Gutiérrez'], fecha_inicio: '2026-02-10' }),
  // El contrato suspendido del prototipo: Martina dejó de venir y la familia pidió pausa.
  elContrato({ cliente_id: cli['Gutiérrez'], servicio_id: srv['Clases escuela'].id, alumno_id: alu['Martina Gutiérrez'], fecha_inicio: '2026-02-10', estado: 'suspendido' }),
  elContrato({ cliente_id: cli['Rossi'], servicio_id: srv['Clases escuela'].id, alumno_id: alu['Tomás Rossi'], fecha_inicio: '2026-02-15' }),
  elContrato({ cliente_id: cli['Rossi'], servicio_id: srv['Clases escuela'].id, alumno_id: alu['Valentina Rossi'], fecha_inicio: '2026-02-15' }),
  elContrato({ cliente_id: cli['Ibáñez'], servicio_id: srv['Clase personalizada'].id, alumno_id: alu['Sofía Ibáñez'], fecha_inicio: '2026-03-01' }),
  elContrato({ cliente_id: cli['Pereyra'], servicio_id: srv['Clases escuela'].id, alumno_id: alu['Lucía Pereyra'], fecha_inicio: '2026-01-20' }),
  // Uno cerrado, para que el histórico no sea una sola foto del presente.
  elContrato({ cliente_id: cli['Rossi'], servicio_id: srv['Volteo'].id, alumno_id: alu['Valentina Rossi'], fecha_inicio: '2026-02-15', fecha_fin: '2026-05-31', estado: 'finalizado' }),
]);
console.log(`contratos: ${contratos.length}`);

// -----------------------------------------------------------------------------
// 6 · Bienestar animal: planes, sanidad e inventario
// -----------------------------------------------------------------------------
const loSanitario = (d) => ({
  producto: null,
  dosis: null,
  profesional: null,
  proxima_fecha: null,
  observaciones: null,
  costo: null,
  registro_cuidado_id: null,
  estado: 'aplicado',
  ...d,
});

await insertar('evento_sanitario', [
  ...caballos.map((c) => loSanitario({ caballo_id: c.id, tipo: 'desparasitacion', fecha: '2026-06-15', producto: 'Ivermectina 1 %', dosis: '1 dosis cada 100 kg', profesional: 'Dra. Vera Antonelli', proxima_fecha: '2026-09-15', costo: 8500 })),
  ...caballos.map((c) => loSanitario({ caballo_id: c.id, tipo: 'desparasitacion', estado: 'previsto', fecha: '2026-09-15', producto: 'Praziquantel', dosis: '1 dosis cada 100 kg', observaciones: 'Rotación de droga respecto del ciclo anterior.' })),
  loSanitario({ caballo_id: cab['Nube'], tipo: 'veterinario', fecha: '2026-08-28', profesional: 'Dra. Vera Antonelli', observaciones: 'Claudicación leve del anterior derecho. Reposo de tres semanas.', proxima_fecha: '2026-09-18', costo: 45000 }),
  loSanitario({ caballo_id: cab['Gambeta'], tipo: 'herrador', fecha: '2026-08-10', profesional: 'Omar Sosa', costo: 32000, proxima_fecha: '2026-10-10' }),
  loSanitario({ caballo_id: cab['Rayo'], tipo: 'vacunacion', fecha: '2026-04-05', producto: 'Influenza equina', profesional: 'Dra. Vera Antonelli', proxima_fecha: '2026-10-05', costo: 12000 }),
]);

const proveedores = await insertar('proveedor', [
  { razon_social: 'Forrajería El Trébol', cuit: '30612340019', telefono: '+5493414440001', email: 'ventas@eltrebol.demo' },
  { razon_social: 'Agroveterinaria Funes', cuit: '30598776441', telefono: '+5493414440002', email: 'pedidos@agrofunes.demo' },
]);

const insumos = await insertar('insumo', [
  { nombre: 'Balanceado equino', categoria: 'alimento', unidad: 'kg', stock_minimo: 200 },
  { nombre: 'Avena', categoria: 'alimento', unidad: 'kg', stock_minimo: 150 },
  { nombre: 'Fardo de alfalfa', categoria: 'alimento', unidad: 'fardo', stock_minimo: 20 },
  { nombre: 'Viruta de pino', categoria: 'cama', unidad: 'bolsa', stock_minimo: 30 },
  { nombre: 'Ivermectina 1 %', categoria: 'sanidad', unidad: 'dosis', stock_minimo: 10 },
  { nombre: 'Alambre de piquete', categoria: 'mantenimiento', unidad: 'metro', stock_minimo: 100 },
]);
const ins = Object.fromEntries(insumos.map((i) => [i.nombre, i.id]));

// El plan nombra el insumo del que sale la ración: es lo que permite que servir
// la toma descuente la existencia sin adivinar nada desde un texto libre. La
// alfalfa de la tarde va sin insumo a propósito, para que quede a la vista el
// caso legítimo de la ración que no descuenta stock.
await insertar(
  'plan_alimentario',
  caballos.flatMap((c) => [
    { caballo_id: c.id, momento: 'manana', descripcion: 'Balanceado de mantenimiento y heno', cantidad_kg: 3.0, insumo_id: ins['Balanceado equino'], vigente_desde: '2026-01-01' },
    { caballo_id: c.id, momento: 'tarde', descripcion: 'Avena y alfalfa', cantidad_kg: 2.5, insumo_id: ins['Avena'], vigente_desde: '2026-01-01' },
  ]),
);

const elMovimiento = (d) => ({ registro_cuidado_id: null, orden_compra_id: null, ...d });

// El stock es derivado: se carga con movimientos, no escribiendo `stock_actual`.
await insertar('movimiento_stock', [
  // El balanceado y la avena de agosto no entran acá: los trae la orden de
  // compra 2026-001, más abajo, con su recepción. Un ingreso suelto que en
  // realidad vino de una orden esconde justamente el vínculo que M10 agrega.
  elMovimiento({ insumo_id: ins['Balanceado equino'], tipo: 'egreso', cantidad: 820, motivo: 'Consumo de agosto', ocurrido_en: enFunes('2026-08-31', '18:00') }),
  elMovimiento({ insumo_id: ins['Avena'], tipo: 'egreso', cantidad: 480, motivo: 'Consumo de agosto', ocurrido_en: enFunes('2026-08-31', '18:00') }),
  // La viruta queda por debajo del mínimo a propósito: es la alerta de reposición.
  elMovimiento({ insumo_id: ins['Viruta de pino'], tipo: 'ingreso', cantidad: 120, motivo: 'Compra mensual', ocurrido_en: enFunes('2026-08-05', '09:00') }),
  elMovimiento({ insumo_id: ins['Viruta de pino'], tipo: 'egreso', cantidad: 108, motivo: 'Reposición de camas', ocurrido_en: enFunes('2026-09-01', '08:00') }),
  elMovimiento({ insumo_id: ins['Fardo de alfalfa'], tipo: 'ingreso', cantidad: 90, motivo: 'Compra mensual', ocurrido_en: enFunes('2026-08-05', '09:00') }),
  elMovimiento({ insumo_id: ins['Fardo de alfalfa'], tipo: 'egreso', cantidad: 62, motivo: 'Consumo de agosto', ocurrido_en: enFunes('2026-08-31', '18:00') }),
  elMovimiento({ insumo_id: ins['Ivermectina 1 %'], tipo: 'ingreso', cantidad: 40, motivo: 'Compra sanitaria', ocurrido_en: enFunes('2026-06-10', '10:00') }),
  elMovimiento({ insumo_id: ins['Ivermectina 1 %'], tipo: 'egreso', cantidad: 27, motivo: 'Ciclo de desparasitación de junio', ocurrido_en: enFunes('2026-06-15', '09:00') }),
  elMovimiento({ insumo_id: ins['Alambre de piquete'], tipo: 'ingreso', cantidad: 500, motivo: 'Compra de mantenimiento', ocurrido_en: enFunes('2026-07-02', '11:00') }),
  elMovimiento({ insumo_id: ins['Alambre de piquete'], tipo: 'egreso', cantidad: 180, motivo: 'Reparación del piquete norte', ocurrido_en: enFunes('2026-07-20', '15:00') }),
  // Reposición de septiembre. Está para que el consumo diario que siembra el
  // bloque de cuidados no deje al balanceado y a la avena bajo el mínimo: el
  // insumo que tiene que verse en rojo es la viruta, y uno solo.
  elMovimiento({ insumo_id: ins['Balanceado equino'], tipo: 'ingreso', cantidad: 600, motivo: 'Compra de septiembre', ocurrido_en: enFunes('2026-09-01', '09:00') }),
  elMovimiento({ insumo_id: ins['Avena'], tipo: 'ingreso', cantidad: 400, motivo: 'Compra de septiembre', ocurrido_en: enFunes('2026-09-01', '09:00') }),
]);

// ---------------------------------------------------------------------------
// Compras. Tres órdenes en tres estados distintos, que son los tres que se
// miran: una recibida y cerrada, una que llegó a medias -el caso que la
// decisión 1.11 agregó al modelo y que sin datos no se ve nunca-, y un borrador
// sin enviar. Los ingresos de las dos primeras entran como movimientos con su
// `orden_compra_id`, así que la existencia que muestran los insumos incluye lo
// que efectivamente llegó y la ficha de cada uno explica de dónde salió.
// ---------------------------------------------------------------------------

// Las órdenes se arman como las arma el sistema y no de un saque: nacen en
// borrador, se les cargan los renglones, salen, y recién ahí se informa lo
// recibido. Los disparadores de M10 no admiten otro orden -un renglón no nace
// recibido, una orden que salió no admite renglones nuevos-, así que sembrar
// esto es además la prueba de que esos invariantes están puestos.
const emitir = async (proveedorId, fechaEmision, renglones) => {
  const orden = await uno('orden_compra', { proveedor_id: proveedorId, fecha_emision: fechaEmision });

  await insertar(
    'detalle_orden_compra',
    renglones.map((r) => ({
      orden_compra_id: orden.id,
      insumo_id: r.insumoId,
      cantidad: r.cantidad,
      cantidad_recibida: null,
      precio_unitario: r.precio,
    })),
  );

  revisar('enviar orden', await db.from('orden_compra').update({ estado: 'enviada' }).eq('id', orden.id));
  return orden;
};

/** Informa una entrega igual que la pantalla: acumula y asienta el ingreso. */
const recibir = async (ordenId, insumoId, cantidad, cuando) => {
  const detalle = revisar(
    'detalle a recibir',
    await db.from('detalle_orden_compra').select('id, cantidad_recibida').eq('orden_compra_id', ordenId).eq('insumo_id', insumoId).single(),
  );

  revisar(
    'recibir',
    await db.from('detalle_orden_compra').update({ cantidad_recibida: (detalle.cantidad_recibida ?? 0) + cantidad }).eq('id', detalle.id),
  );

  await insertar('movimiento_stock', [
    elMovimiento({ insumo_id: insumoId, tipo: 'ingreso', cantidad, motivo: 'Recepción de orden de compra', orden_compra_id: ordenId, ocurrido_en: cuando }),
  ]);
};

// Una orden cerrada: llegó todo y el disparador la dejó en `recibida`.
const ordenCerrada = await emitir(proveedores[0].id, '2026-08-04', [
  { insumoId: ins['Balanceado equino'], cantidad: 1000, precio: 980 },
  { insumoId: ins['Avena'], cantidad: 600, precio: 720 },
]);
await recibir(ordenCerrada.id, ins['Balanceado equino'], 1000, enFunes('2026-08-05', '09:00'));
await recibir(ordenCerrada.id, ins['Avena'], 600, enFunes('2026-08-05', '09:00'));

// Una orden a medias: llegó la alfalfa y no la viruta. Es el caso que la
// decisión 1.11 agregó al modelo y que sin datos no se ve nunca; es además el
// motivo por el que la viruta queda bajo mínimo y en rojo en la pantalla.
const ordenParcial = await emitir(proveedores[0].id, '2026-09-02', [
  { insumoId: ins['Fardo de alfalfa'], cantidad: 100, precio: 4200 },
  { insumoId: ins['Viruta de pino'], cantidad: 150, precio: 3100 },
]);
await recibir(ordenParcial.id, ins['Fardo de alfalfa'], 100, enFunes('2026-09-03', '10:00'));

// Un borrador sin enviar, para que se vea el estado en que nace una orden.
const ordenBorrador = await uno('orden_compra', { proveedor_id: proveedores[1].id, fecha_emision: HOY });
await insertar('detalle_orden_compra', [
  { orden_compra_id: ordenBorrador.id, insumo_id: ins['Ivermectina 1 %'], cantidad: 60, cantidad_recibida: null, precio_unitario: 2400 },
]);

// Un conteo físico que dio de menos: el ajuste con signo negativo que hasta M10
// el modelo no podía representar, y el que explica por qué la viruta no coincide
// con la cuenta de ingresos y egresos.
await insertar('movimiento_stock', [
  elMovimiento({ insumo_id: ins['Viruta de pino'], tipo: 'ajuste', cantidad: -6, motivo: 'Rotura de bolsas en el depósito', ocurrido_en: enFunes('2026-09-04', '17:00') }),
]);

console.log(
  `compras: ${proveedores.length} proveedores y 3 órdenes ` +
    `(${ordenCerrada.numero} recibida, ${ordenParcial.numero} parcial, ${ordenBorrador.numero} en borrador)`,
);

// ---------------------------------------------------------------------------
// El trabajo del peón de los últimos días.
//
// Es lo que hace que la jornada, la ficha del caballo y la última reposición de
// cama tengan algo que mostrar. Cada registro nace con identificador propio
// (decisión 1.6) y el consumo cuelga de él (decisión 1.7): son las dos
// propiedades que M14 va a necesitar intactas cuando enganche la cola.
// ---------------------------------------------------------------------------
const DIAS_DE_CUIDADO = ['2026-09-03', '2026-09-04', '2026-09-05'];

const elCuidado = (d) => ({
  instalacion_id: null,
  observaciones: null,
  sincronizado_en: d.ocurrido_en,
  registrado_en: d.ocurrido_en,
  usuario_id: PEON,
  ...d,
});

const cuidados = [];
const consumos = [];

for (const dia of DIAS_DE_CUIDADO) {
  for (const [momento, hora, insumo, kilos] of [
    ['manana', '07:30', 'Balanceado equino', 3.0],
    ['tarde', '17:30', 'Avena', 2.5],
  ]) {
    for (const c of caballos) {
      const id = crypto.randomUUID();
      const ocurrido = enFunes(dia, hora);

      cuidados.push(
        elCuidado({
          id,
          caballo_id: c.id,
          instalacion_id: c.instalacion_id,
          tipo: 'alimentacion',
          ocurrido_en: ocurrido,
          // Una novedad real, para que el campo de observaciones no se vea vacío
          // en todas las filas: Nube está en tratamiento y come menos.
          observaciones:
            c.nombre === 'Nube' && momento === 'manana' && dia === '2026-09-05'
              ? 'Dejó la mitad de la ración. Sigue en reposo por la claudicación.'
              : null,
        }),
      );

      consumos.push(
        elMovimiento({
          insumo_id: ins[insumo],
          tipo: 'egreso',
          cantidad: kilos,
          motivo: 'Ración servida',
          registro_cuidado_id: id,
          ocurrido_en: ocurrido,
        }),
      );
    }
  }
}

// Higiene: los boxes ocupados en distintos días, para que «última reposición»
// muestre antigüedades distintas y no una columna toda igual. El Box 8 está
// desocupado y va SIN caballo: es el camino 2.a del CUS03, y el que prueba que
// la restricción nueva de la base deja pasar exactamente ese caso.
const BOXES_OCUPADOS = ['Gambeta', 'Malbec', 'Lucero', 'Pampa', 'Rayo', 'Tormenta', 'Sultán'];

for (const [i, nombre] of BOXES_OCUPADOS.entries()) {
  const dia = DIAS_DE_CUIDADO[i % DIAS_DE_CUIDADO.length];
  const id = crypto.randomUUID();
  const ocurrido = enFunes(dia, '09:00');
  const caballo = caballos.find((c) => c.nombre === nombre);
  const repone = i < 2; // sólo dos repusieron cama: el resto fue limpieza sola

  cuidados.push(
    elCuidado({
      id,
      caballo_id: caballo.id,
      instalacion_id: caballo.instalacion_id,
      tipo: 'higiene',
      ocurrido_en: ocurrido,
      observaciones: i === 3 ? 'Filtración en el ángulo sur del box.' : null,
    }),
  );

  if (repone) {
    consumos.push(
      elMovimiento({
        insumo_id: ins['Viruta de pino'],
        tipo: 'egreso',
        cantidad: 2,
        motivo: 'Material repuesto',
        registro_cuidado_id: id,
        ocurrido_en: ocurrido,
      }),
    );
  }
}

cuidados.push(
  elCuidado({
    id: crypto.randomUUID(),
    caballo_id: null,
    instalacion_id: inst['Box 8'],
    tipo: 'higiene',
    ocurrido_en: enFunes('2026-09-04', '09:30'),
    observaciones: 'Box desocupado: limpieza general antes de recibir un pupilo.',
  }),
);

await insertar('registro_cuidado', cuidados);
await insertar('movimiento_stock', consumos, 'movimiento_stock (consumo del cuidado)');

// La orden de compra que M9 sembraba acá se fue al bloque de compras, que las
// arma recorriendo el ciclo completo. Ésta nacía directamente en `enviada` con
// sus renglones cargados después, y M10 ya no lo permite: una orden que salió no
// admite renglones nuevos. El dato no se pierde, se arma bien.
console.log(
  `bienestar animal: planes de ${caballos.length} caballos, sanidad, ${insumos.length} insumos ` +
    `y ${cuidados.length} registros de cuidado (uno sobre box desocupado)`,
);

// -----------------------------------------------------------------------------
// 7 · Agenda: la semana tipo, repetida de junio a mediados de septiembre
// -----------------------------------------------------------------------------
const SEMANA = [
  { dia: 1, hora: '16:00', servicio: 'Clases escuela', nivel: 'nivel_1', instalacion: 'Pista A', cupo: 6, duracion: 60 },
  { dia: 2, hora: '10:00', servicio: 'Clase personalizada', nivel: 'nivel_2', instalacion: 'Picadero techado', cupo: null, duracion: 45 },
  { dia: 3, hora: '16:00', servicio: 'Clases escuela', nivel: 'inicial', instalacion: 'Pista A', cupo: 6, duracion: 60 },
  { dia: 4, hora: '17:00', servicio: 'Volteo', nivel: 'inicial', instalacion: 'Pista B', cupo: 8, duracion: 60 },
  { dia: 5, hora: '16:00', servicio: 'Clases escuela', nivel: 'nivel_1', instalacion: 'Pista A', cupo: 6, duracion: 60 },
  { dia: 6, hora: '10:00', servicio: 'Clases escuela', nivel: 'nivel_3', instalacion: 'Pista A', cupo: 6, duracion: 60 },
];

/** A quién se anota en cada franja de la semana. */
const ANOTADOS = {
  'Clases escuela|nivel_1': ['Joaquín Gutiérrez', 'Tomás Rossi', 'Valentina Rossi'],
  'Clases escuela|inicial': ['Martina Gutiérrez'],
  'Clases escuela|nivel_3': ['Lucía Pereyra'],
  'Clase personalizada|nivel_2': ['Sofía Ibáñez'],
  'Volteo|inicial': ['Martina Gutiérrez', 'Valentina Rossi'],
};

/**
 * Qué caballo monta habitualmente cada alumno.
 *
 * Gambeta queda deliberadamente cargado de más: es el caso que el reporte de
 * carga de trabajo existe para detectar, y el que el prototipo cuenta.
 */
const CABALLO_HABITUAL = {
  'Joaquín Gutiérrez': 'Malbec',
  'Martina Gutiérrez': 'Lucero',
  'Tomás Rossi': 'Gambeta',
  'Valentina Rossi': 'Gambeta',
  'Sofía Ibáñez': 'Gambeta',
  'Lucía Pereyra': 'Pampa',
};

/**
 * Cada cuántas clases falta cada alumno, por mes.
 *
 * Martina y Tomás caen de forma sostenida: son los dos que el reporte tiene que
 * marcar en riesgo. La caída de Martina es además la que explica el contrato
 * suspendido de la familia.  0 = no falta nunca.
 */
const FALTA_CADA = {
  'Joaquín Gutiérrez': { '2026-06': 0, '2026-07': 0, '2026-08': 6, '2026-09': 0 },
  'Martina Gutiérrez': { '2026-06': 6, '2026-07': 3, '2026-08': 2, '2026-09': 1 },
  'Tomás Rossi': { '2026-06': 0, '2026-07': 6, '2026-08': 4, '2026-09': 1 },
  'Valentina Rossi': { '2026-06': 5, '2026-07': 6, '2026-08': 5, '2026-09': 0 },
  'Sofía Ibáñez': { '2026-06': 0, '2026-07': 0, '2026-08': 0, '2026-09': 0 },
  'Lucía Pereyra': { '2026-06': 4, '2026-07': 5, '2026-08': 0, '2026-09': 2 },
};

const DESDE = new Date('2026-06-01T12:00:00Z');
const HASTA = new Date('2026-09-19T12:00:00Z');
const hoyInstante = new Date(`${HOY}T12:00:00Z`);

// Un par de suspensiones, que es lo que pasa de verdad en invierno.
const SUSPENDIDAS = {
  '2026-07-15': 'Lluvia: pista anegada',
  '2026-08-20': 'Tormenta con alerta amarilla',
};

const clasesNuevas = [];
const inscripcionesNuevas = [];
const asistenciasNuevas = [];
const vistas = {};

for (let d = new Date(DESDE); d <= HASTA; d.setUTCDate(d.getUTCDate() + 1)) {
  const fecha = d.toISOString().slice(0, 10);
  const franja = SEMANA.find((s) => s.dia === d.getUTCDay());
  if (!franja) continue;

  const pasada = d < hoyInstante;
  const motivo = SUSPENDIDAS[fecha];
  const claseId = randomUUID();
  const periodo = fecha.slice(0, 7);

  clasesNuevas.push({
    id: claseId,
    servicio_id: srv[franja.servicio].id,
    instructor_id: INSTRUCTOR,
    instalacion_id: inst[franja.instalacion],
    inicia_en: enFunes(fecha, franja.hora),
    duracion_min: franja.duracion,
    cupo: srv[franja.servicio].modalidad === 'individual' ? null : franja.cupo,
    nivel: franja.nivel,
    estado: motivo ? 'cancelada' : pasada ? 'dictada' : 'programada',
    motivo_suspension: motivo ?? null,
  });

  for (const nombre of ANOTADOS[`${franja.servicio}|${franja.nivel}`] ?? []) {
    const habitual = CABALLO_HABITUAL[nombre];
    inscripcionesNuevas.push({
      clase_id: claseId,
      alumno_id: alu[nombre],
      caballo_id: cab[habitual],
      inscripto_en: enFunes(fecha, '08:00'),
      estado: 'inscripto',
      cancelado_en: null,
    });

    if (!pasada || motivo) continue;

    // Determinista a propósito: el mismo guion da siempre el mismo haras.
    const clave = `${nombre}|${periodo}`;
    vistas[clave] = (vistas[clave] ?? 0) + 1;
    const cada = FALTA_CADA[nombre]?.[periodo] ?? 0;
    const presente = cada === 0 || vistas[clave] % cada !== 0;

    asistenciasNuevas.push({
      clase_id: claseId,
      alumno_id: alu[nombre],
      presente,
      // Cada tanto monta otro: es la sustitución del camino 7.c del CUS05.
      caballo_id: presente ? cab[vistas[clave] % 7 === 0 ? 'Pampa' : habitual] : null,
      observaciones:
        presente && vistas[clave] % 5 === 0
          ? 'Buena posición al trote. Sigue trabajando el galope.'
          : null,
      registrado_por: INSTRUCTOR,
    });
  }
}

for (let i = 0; i < clasesNuevas.length; i += 100) await insertar('clase', clasesNuevas.slice(i, i + 100));
for (let i = 0; i < inscripcionesNuevas.length; i += 200) await insertar('inscripcion', inscripcionesNuevas.slice(i, i + 200));
for (let i = 0; i < asistenciasNuevas.length; i += 200) await insertar('asistencia', asistenciasNuevas.slice(i, i + 200));
console.log(`agenda: ${clasesNuevas.length} clases, ${inscripcionesNuevas.length} inscripciones, ${asistenciasNuevas.length} asistencias`);

// -----------------------------------------------------------------------------
// 8 · Cuentas corrientes, cargos y pagos
//
// El cargo de un servicio mensual es su tarifa vigente; el de uno por clase es
// lo que efectivamente se dictó, que es la regla que M8 hace verificable.
// -----------------------------------------------------------------------------
const cuentas = await insertar(
  'cuenta_corriente',
  clientes.map((c) => ({ cliente_id: c.id })),
);
const cuentaDe = Object.fromEntries(cuentas.map((c) => [c.cliente_id, c.id]));

const PERIODOS = ['2026-06', '2026-07', '2026-08'];
const vencimientoDe = (periodo, clienteId) => {
  const dia = clientes.find((c) => c.id === clienteId).dia_vencimiento ?? 10;
  return `${periodo}-${String(dia).padStart(2, '0')}`;
};

const asistidasDe = (alumnoNombre, periodo) =>
  asistenciasNuevas.filter(
    (a) =>
      a.alumno_id === alu[alumnoNombre] &&
      a.presente &&
      clasesNuevas.find((c) => c.id === a.clase_id).inicia_en.slice(0, 7) === periodo,
  ).length;

/**
 * `creado_en` se fija a mano y no se deja en su valor por omisión.
 *
 * El libro mayor se ordena por periodo y creado_en, y la pantalla de pagos
 * filtra por fecha: con el `now()` de la base, tres meses de movimientos
 * aparecían todos cargados hoy, uno encima del otro. El cierre del mes ocurre
 * el dia_cierre_periodo, que el haras tiene en 1.
 */
const elCargo = (d) => ({
  comprobante_id: null,
  pago_id: null,
  mora_base: null,
  mora_tasa_aplicada: null,
  mora_dias: null,
  aplicado_por: null,
  ...d,
});

const movimientos = [];
for (const periodo of PERIODOS) {
  const primero = `${periodo}-01`;

  for (const contrato of contratos.filter((c) => c.estado === 'vigente')) {
    const servicio = servicios.find((s) => s.id === contrato.servicio_id);
    const cuenta = cuentaDe[contrato.cliente_id];

    if (servicio.unidad === 'mensual') {
      movimientos.push(
        elCargo({
          cuenta_corriente_id: cuenta,
          tipo: 'cargo',
          concepto: `${servicio.nombre} · ${caballos.find((c) => c.id === contrato.caballo_id).nombre}`,
          contrato_id: contrato.id,
          importe: precioAl(servicio.nombre, primero),
          periodo: primero,
          vence_en: vencimientoDe(periodo, contrato.cliente_id),
          creado_en: enFunes(primero, '09:00'),
        }),
      );
      continue;
    }

    const alumnoNombre = Object.keys(alu).find((k) => alu[k] === contrato.alumno_id);
    const clases = asistidasDe(alumnoNombre, periodo);
    if (clases === 0) continue;

    movimientos.push(
      elCargo({
        cuenta_corriente_id: cuenta,
        tipo: 'cargo',
        concepto: `${servicio.nombre} · ${alumnoNombre} · ${clases} clases dictadas`,
        contrato_id: contrato.id,
        importe: clases * precioAl(servicio.nombre, primero),
        periodo: primero,
        vence_en: vencimientoDe(periodo, contrato.cliente_id),
        creado_en: enFunes(primero, '09:00'),
      }),
    );
  }
}
await insertar('movimiento_cuenta', movimientos, 'cargos');

/** Quién pagó qué: deja la cartera con los tres estados del semáforo. */
const PAGARON = {
  Gutiérrez: ['2026-06', '2026-07'],
  Rossi: ['2026-06'],
  Ibáñez: ['2026-06', '2026-07', '2026-08'],
  Pereyra: ['2026-06', '2026-07'],
  Domínguez: ['2026-06'],
  'Establecimiento La Media Luna S.R.L.': ['2026-06', '2026-07', '2026-08'],
};

const MEDIO = {
  Gutiérrez: 'transferencia',
  Rossi: 'efectivo',
  Ibáñez: 'mercadopago',
  Pereyra: 'transferencia',
  Domínguez: 'efectivo',
  'Establecimiento La Media Luna S.R.L.': 'transferencia',
};

let pagos = 0;
for (const [nombre, periodos] of Object.entries(PAGARON)) {
  const clienteId = cli[nombre];
  for (const periodo of periodos) {
    const total = movimientos
      .filter((m) => m.cuenta_corriente_id === cuentaDe[clienteId] && m.periodo === `${periodo}-01`)
      .reduce((a, m) => a + m.importe, 0);
    if (total === 0) continue;

    const cuando = enFunes(vencimientoDe(periodo, clienteId), '11:30');
    const pago = await uno('pago', {
      cliente_id: clienteId,
      importe: total,
      medio: MEDIO[nombre],
      referencia_externa: `DEMO-${nombre.slice(0, 4).toUpperCase()}-${periodo}`,
      estado: 'acreditado',
      acreditado_en: cuando,
      creado_en: cuando,
    });

    await uno(
      'movimiento_cuenta',
      elCargo({
        cuenta_corriente_id: cuentaDe[clienteId],
        tipo: 'pago',
        concepto: `Pago recibido · ${MEDIO[nombre]}`,
        contrato_id: null,
        importe: -total,
        periodo: null,
        vence_en: null,
        pago_id: pago.id,
        creado_en: cuando,
      }),
    );
    pagos += 1;
  }
}
console.log(`gerencia: ${cuentas.length} cuentas, ${movimientos.length} cargos y ${pagos} pagos`);

const { data: cartera } = await db.from('cuenta_corriente').select('saldo, cliente:cliente_id (razon_social, persona:persona_id (apellido))');
console.log('\nsaldos:');
for (const c of cartera ?? []) {
  const nombre = c.cliente?.razon_social ?? c.cliente?.persona?.apellido ?? '?';
  console.log(`  ${nombre.padEnd(38)} $${Number(c.saldo).toLocaleString('es-AR')}`);
}

// -----------------------------------------------------------------------------
// 7 · Portal del cliente (M13)
//
// Dos accesos, elegidos porque entre los dos recorren las cuatro pantallas:
// Marcela tiene dos alumnos (Joaquín y Martina) y ningún caballo, así que
// prueba el filtro de la agenda y el estado vacío de «Mis caballos»; Lucía es
// alumna de sí misma y además propietaria de Aurora, así que prueba la ficha
// del caballo con novedades reales. Ninguna de las dos es una persona nueva:
// `crearAccesoDePortal` reutiliza la que ya tienen como clientas.
// -----------------------------------------------------------------------------
console.log('portal:');
await crearAccesoDePortal({
  personaId: per['Marcela Gutiérrez'],
  documento: '27418256',
  email: 'marcela.gutierrez@correo.demo',
});
await crearAccesoDePortal({
  personaId: per['Lucía Pereyra'],
  documento: '33871402',
  email: 'lucia.pereyra@correo.demo',
});

// Un torneo abierto, para que «Novedades y avisos» tenga algo que inscribir y
// no sólo el estado vacío. Nace `abierto` directamente: M15 (Automatizaciones
// y eventos) es quien va a construir la pantalla que lo hace nacer en
// `borrador`; hasta entonces, sembrarlo ya abierto no inventa nada que el
// modelo no permita (`estado_evento` lo declara desde el esquema base).
const torneo = await uno('evento', {
  nombre: 'Torneo interno de salto',
  tipo: 'torneo',
  inicia_en: enFunes('2026-10-03', '10:00'),
  finaliza_en: enFunes('2026-10-03', '18:00'),
  cierra_inscripcion_en: '2026-09-28',
  cupo: 20,
  estado: 'abierto',
});
await insertar('inscripcion_evento', [
  // Uno ya inscripto, para que la pantalla también muestre el cupo bajando.
  { evento_id: torneo.id, cliente_id: cli['Rossi'], alumno_id: alu['Tomás Rossi'], caballo_id: null },
]);
console.log(`  ${torneo.nombre}: abierto hasta el 28/09, 1 de 20 cupos ocupados`);
