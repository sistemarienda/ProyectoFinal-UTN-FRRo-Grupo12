import { describe, expect, it } from 'vitest';
import {
  type CaballoDelTurno,
  type PlanComputable,
  alertasSanitarias,
  clasificarVencimiento,
  diasEntre,
  fechaCorrida,
  filasDeFormulario,
  momentoDe,
  ocurrenciaDelMomento,
  planVigenteEn,
  planesVigentesEn,
  rotacionDeDroga,
  tareasDeAlimentacion,
} from './bienestar';

const plan = (p: Partial<PlanComputable> & Pick<PlanComputable, 'momento' | 'vigenteDesde'>): PlanComputable => ({
  id: `${p.momento}-${p.vigenteDesde}`,
  descripcion: 'Balanceado',
  cantidadKg: 4,
  insumoId: 'insumo-balanceado',
  ...p,
});

const caballo = (p: Partial<CaballoDelTurno> & Pick<CaballoDelTurno, 'id'>): CaballoDelTurno => ({
  nombre: p.id,
  estado: 'activo',
  pesoKg: 480,
  instalacionId: 'box-14',
  instalacionNombre: 'Box 14',
  ...p,
});

describe('momentoDe', () => {
  it('propone la mañana temprano, el mediodía desde las 11 y la tarde desde las 16', () => {
    // Funes está en UTC-3, así que 09:00 locales son las 12:00 UTC.
    expect(momentoDe('2026-09-08T12:00:00Z')).toBe('manana');
    expect(momentoDe('2026-09-08T15:00:00Z')).toBe('mediodia');
    expect(momentoDe('2026-09-08T19:00:00Z')).toBe('tarde');
  });

  it('toma la hora del corte como parte del momento que empieza, no del anterior', () => {
    expect(momentoDe('2026-09-08T14:00:00Z')).toBe('mediodia'); // 11:00 locales
    expect(momentoDe('2026-09-08T13:59:00Z')).toBe('manana'); // 10:59 locales
  });
});

describe('ocurrenciaDelMomento', () => {
  it('usa el instante real cuando se registra dentro del mismo momento', () => {
    // 09:00 locales del 8, registrando la mañana del 8.
    const ahora = new Date('2026-09-08T12:00:00Z');
    expect(ocurrenciaDelMomento('manana', '2026-09-08', ahora)).toBe(ahora.toISOString());
  });

  it('fecha la toma en su momento cuando el peón se pone al día más tarde', () => {
    // El defecto que destapó el QA: la mañana registrada 13:45 quedaba contada
    // como mediodía, y la jornada seguía mostrándola pendiente.
    const ahora = new Date('2026-09-08T16:45:00Z'); // 13:45 locales
    const ocurrio = ocurrenciaDelMomento('manana', '2026-09-08', ahora);

    expect(momentoDe(ocurrio)).toBe('manana');
    expect(ocurrio).not.toBe(ahora.toISOString());
  });

  it('registrar un día anterior no toma la hora de hoy', () => {
    const ahora = new Date('2026-09-08T12:00:00Z'); // mañana del 8
    const ocurrio = ocurrenciaDelMomento('manana', '2026-09-07', ahora);

    expect(ocurrio.slice(0, 10)).toBe('2026-09-07');
    expect(momentoDe(ocurrio)).toBe('manana');
  });

  it('cada momento cae dentro de su propia franja', () => {
    const ahora = new Date('2026-09-08T12:00:00Z');
    for (const m of ['manana', 'mediodia', 'tarde'] as const) {
      expect(momentoDe(ocurrenciaDelMomento(m, '2026-09-01', ahora))).toBe(m);
    }
  });
});

describe('planesVigentesEn', () => {
  it('elige por momento el más reciente que no sea posterior a la fecha', () => {
    const planes = [
      plan({ momento: 'manana', vigenteDesde: '2026-03-01', cantidadKg: 3 }),
      plan({ momento: 'manana', vigenteDesde: '2026-08-01', cantidadKg: 5 }),
      plan({ momento: 'tarde', vigenteDesde: '2026-03-01', cantidadKg: 2 }),
    ];

    const vigentes = planesVigentesEn(planes, '2026-09-08');
    expect(vigentes.get('manana')?.cantidadKg).toBe(5);
    expect(vigentes.get('tarde')?.cantidadKg).toBe(2);
  });

  it('cada momento se resuelve por su cuenta: uno actualizado no arrastra al otro', () => {
    const planes = [
      plan({ momento: 'manana', vigenteDesde: '2026-08-01' }),
      plan({ momento: 'tarde', vigenteDesde: '2026-03-01' }),
    ];

    const vigentes = planesVigentesEn(planes, '2026-09-08');
    expect(vigentes.get('manana')?.vigenteDesde).toBe('2026-08-01');
    expect(vigentes.get('tarde')?.vigenteDesde).toBe('2026-03-01');
  });

  it('ignora los planes que todavía no rigen', () => {
    const planes = [plan({ momento: 'manana', vigenteDesde: '2026-12-01' })];
    expect(planesVigentesEn(planes, '2026-09-08').size).toBe(0);
  });

  it('toma la fecha exacta de vigencia como aplicable', () => {
    const planes = [plan({ momento: 'manana', vigenteDesde: '2026-09-08' })];
    expect(planVigenteEn(planes, 'manana', '2026-09-08')).not.toBeNull();
  });

  it('devuelve null para un momento sin plan', () => {
    expect(planVigenteEn([], 'mediodia', '2026-09-08')).toBeNull();
  });
});

describe('tareasDeAlimentacion', () => {
  const planes = new Map([
    ['tornado', [plan({ momento: 'manana', vigenteDesde: '2026-01-01' })]],
    ['bandido', [plan({ momento: 'manana', vigenteDesde: '2026-01-01', cantidadKg: null })]],
  ]);

  it('marca hecho el caballo que ya tiene registro en ese momento', () => {
    const tareas = tareasDeAlimentacion(
      [caballo({ id: 'tornado' }), caballo({ id: 'bandido' })],
      planes,
      [{ caballoId: 'tornado', tipo: 'alimentacion', ocurridoEn: '2026-09-08T12:00:00Z' }],
      'manana',
      '2026-09-08',
    );

    expect(tareas.find((t) => t.caballo.id === 'tornado')?.hecho).toBe(true);
    expect(tareas.find((t) => t.caballo.id === 'bandido')?.hecho).toBe(false);
  });

  it('un registro de otro momento no da por hecha la toma del turno', () => {
    const tareas = tareasDeAlimentacion(
      [caballo({ id: 'tornado' })],
      planes,
      [{ caballoId: 'tornado', tipo: 'alimentacion', ocurridoEn: '2026-09-08T19:00:00Z' }], // tarde
      'manana',
      '2026-09-08',
    );

    expect(tareas[0]?.hecho).toBe(false);
  });

  it('un registro de higiene no da por hecha la alimentación', () => {
    const tareas = tareasDeAlimentacion(
      [caballo({ id: 'tornado' })],
      planes,
      [{ caballoId: 'tornado', tipo: 'higiene', ocurridoEn: '2026-09-08T12:00:00Z' }],
      'manana',
      '2026-09-08',
    );

    expect(tareas[0]?.hecho).toBe(false);
  });

  it('la higiene de un box desocupado no altera las tareas: no le dio de comer a nadie', () => {
    const tareas = tareasDeAlimentacion(
      [caballo({ id: 'tornado' })],
      planes,
      [{ caballoId: null, tipo: 'higiene', ocurridoEn: '2026-09-08T12:00:00Z' }],
      'manana',
      '2026-09-08',
    );

    expect(tareas).toHaveLength(1);
    expect(tareas[0]?.hecho).toBe(false);
  });

  it('deja fuera al retirado y conserva al que está en tratamiento', () => {
    const tareas = tareasDeAlimentacion(
      [
        caballo({ id: 'tornado', estado: 'retirado' }),
        caballo({ id: 'bandido', estado: 'en_tratamiento' }),
      ],
      planes,
      [],
      'manana',
      '2026-09-08',
    );

    expect(tareas.map((t) => t.caballo.id)).toEqual(['bandido']);
  });

  it('explica por qué no puede proponer la ración en kilos', () => {
    const tareas = tareasDeAlimentacion(
      [
        caballo({ id: 'tornado' }), // plan con cantidad y peso: se puede
        caballo({ id: 'bandido' }), // plan sin cantidad
        caballo({ id: 'sinplan' }), // sin plan vigente
        caballo({ id: 'sinpeso', pesoKg: null }),
      ],
      new Map([...planes, ['sinpeso', [plan({ momento: 'manana', vigenteDesde: '2026-01-01' })]]]),
      [],
      'manana',
      '2026-09-08',
    );

    const motivo = (id: string) => tareas.find((t) => t.caballo.id === id)?.motivoSinRacion;
    expect(motivo('tornado')).toBeNull();
    expect(motivo('bandido')).toBe('sin_cantidad');
    expect(motivo('sinplan')).toBe('sin_plan');
    expect(motivo('sinpeso')).toBe('sin_peso');
  });
});

describe('fechaCorrida y diasEntre', () => {
  it('cruza el fin de mes sin correrse un día', () => {
    expect(fechaCorrida('2026-01-31', 1)).toBe('2026-02-01');
    expect(fechaCorrida('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('resuelve el año bisiesto', () => {
    expect(fechaCorrida('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('cuenta días de calendario y devuelve negativo hacia atrás', () => {
    expect(diasEntre('2026-09-08', '2026-09-18')).toBe(10);
    expect(diasEntre('2026-09-08', '2026-09-01')).toBe(-7);
    expect(diasEntre('2026-09-08', '2026-09-08')).toBe(0);
  });

  it('rechaza una fecha que no tiene forma de fecha', () => {
    expect(() => fechaCorrida('08/09/2026', 1)).toThrow(RangeError);
  });
});

describe('clasificarVencimiento', () => {
  it('vencido, por vencer y al día según la antelación configurada', () => {
    expect(clasificarVencimiento('2026-09-07', '2026-09-08', 30)).toBe('vencido');
    expect(clasificarVencimiento('2026-09-20', '2026-09-08', 30)).toBe('por_vencer');
    expect(clasificarVencimiento('2026-12-20', '2026-09-08', 30)).toBe('al_dia');
  });

  it('el día del vencimiento todavía no está vencido, pero sí avisa', () => {
    expect(clasificarVencimiento('2026-09-08', '2026-09-08', 30)).toBe('por_vencer');
  });

  it('el último día de la ventana entra en el aviso', () => {
    expect(clasificarVencimiento('2026-10-08', '2026-09-08', 30)).toBe('por_vencer');
    expect(clasificarVencimiento('2026-10-09', '2026-09-08', 30)).toBe('al_dia');
  });

  it('sin próxima fecha no hay vencimiento que clasificar', () => {
    expect(clasificarVencimiento(null, '2026-09-08', 30)).toBeNull();
  });
});

describe('alertasSanitarias', () => {
  it('avisa lo vencido y lo por vencer, y ordena por urgencia', () => {
    const alertas = alertasSanitarias(
      [
        { caballoId: 'a', tipo: 'vacunacion', estado: 'aplicado', proximaFecha: '2026-09-20' },
        { caballoId: 'b', tipo: 'desparasitacion', estado: 'aplicado', proximaFecha: '2026-08-01' },
        { caballoId: 'c', tipo: 'herrador', estado: 'aplicado', proximaFecha: '2027-05-01' },
      ],
      '2026-09-08',
      30,
    );

    expect(alertas.map((a) => a.caballoId)).toEqual(['b', 'a']);
    expect(alertas[0]?.estado).toBe('vencido');
    expect(alertas[0]?.diasRestantes).toBe(-38);
    expect(alertas[1]?.estado).toBe('por_vencer');
  });

  it('un evento previsto no vence: ya está agendado', () => {
    const alertas = alertasSanitarias(
      [{ caballoId: 'a', tipo: 'desparasitacion', estado: 'previsto', proximaFecha: '2026-08-01' }],
      '2026-09-08',
      30,
    );

    expect(alertas).toEqual([]);
  });

  it('un evento omitido tampoco entra por esta vía', () => {
    const alertas = alertasSanitarias(
      [{ caballoId: 'a', tipo: 'desparasitacion', estado: 'omitido', proximaFecha: '2026-08-01' }],
      '2026-09-08',
      30,
    );

    expect(alertas).toEqual([]);
  });

  it('con varios eventos del mismo tipo se queda con el vencimiento más cercano', () => {
    const alertas = alertasSanitarias(
      [
        { caballoId: 'a', tipo: 'desparasitacion', estado: 'aplicado', proximaFecha: '2026-09-25' },
        { caballoId: 'a', tipo: 'desparasitacion', estado: 'aplicado', proximaFecha: '2026-09-12' },
      ],
      '2026-09-08',
      30,
    );

    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.proximaFecha).toBe('2026-09-12');
  });

  it('el evento sin próxima fecha no genera alerta', () => {
    const alertas = alertasSanitarias(
      [{ caballoId: 'a', tipo: 'veterinario', estado: 'aplicado', proximaFecha: null }],
      '2026-09-08',
      30,
    );

    expect(alertas).toEqual([]);
  });
});

describe('rotacionDeDroga', () => {
  it('devuelve los productos aplicados del más viejo al más reciente', () => {
    expect(
      rotacionDeDroga([
        { fecha: '2026-06-01', estado: 'aplicado', producto: 'Praziquantel' },
        { fecha: '2026-01-15', estado: 'aplicado', producto: 'Ivermectina' },
      ]),
    ).toEqual(['Ivermectina', 'Praziquantel']);
  });

  it('deja fuera lo programado y lo omitido: la rotación es lo que se aplicó', () => {
    expect(
      rotacionDeDroga([
        { fecha: '2026-01-15', estado: 'aplicado', producto: 'Ivermectina' },
        { fecha: '2026-06-01', estado: 'omitido', producto: 'Praziquantel' },
        { fecha: '2026-12-01', estado: 'previsto', producto: 'Ivermectina' },
      ]),
    ).toEqual(['Ivermectina']);
  });

  it('descarta el producto vacío en lugar de mostrar un hueco', () => {
    expect(
      rotacionDeDroga([
        { fecha: '2026-01-15', estado: 'aplicado', producto: '  ' },
        { fecha: '2026-06-01', estado: 'aplicado', producto: null },
      ]),
    ).toEqual([]);
  });
});

describe('filasDeFormulario', () => {
  function formularioDeAlimentacion() {
    const datos = new FormData();
    datos.set('filas', 'a,b');
    datos.set('momento', 'manana');
    datos.set('fecha', '2026-09-16');
    datos.set('id-a', 'reg-a');
    datos.set('caballo-a', 'caballo-a');
    datos.set('hacer-a', 'si');
    datos.set('cantidad-a', '4,5');
    datos.set('obs-a', 'comió todo');
    datos.set('insumo-a', 'insumo-1');
    datos.set('id-b', 'reg-b');
    datos.set('caballo-b', 'caballo-b');
    datos.set('hacer-b', 'no'); // salteado: no debe salir en el resultado
    return datos;
  }

  it('arma sólo las filas marcadas para hacer, con la coma decimal convertida', () => {
    const filas = filasDeFormulario(formularioDeAlimentacion(), new Date('2026-09-16T14:00:00Z'));

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      id: 'reg-a',
      caballoId: 'caballo-a',
      instalacionId: null,
      insumoId: 'insumo-1',
      cantidad: 4.5,
      observaciones: 'comió todo',
    });
  });

  it('usa `ocurrenciaDelMomento` cuando vienen momento y fecha, y "ahora" cuando no', () => {
    const ahora = new Date('2026-09-16T14:00:00Z');
    const conMomento = filasDeFormulario(formularioDeAlimentacion(), ahora);
    expect(conMomento[0]!.ocurridoEn).toBe(ocurrenciaDelMomento('manana', '2026-09-16', ahora));

    const datosDeHigiene = new FormData();
    datosDeHigiene.set('filas', 'box-1');
    datosDeHigiene.set('id-box-1', 'reg-1');
    datosDeHigiene.set('instalacion-box-1', 'inst-1');
    datosDeHigiene.set('caballo-box-1', '');
    datosDeHigiene.set('hacer-box-1', 'si');

    const sinMomento = filasDeFormulario(datosDeHigiene, ahora);
    expect(sinMomento[0]).toMatchObject({ caballoId: null, instalacionId: 'inst-1', ocurridoEn: ahora.toISOString() });
  });

  it('sin filas marcadas, devuelve una lista vacía', () => {
    const datos = new FormData();
    datos.set('filas', 'a');
    datos.set('hacer-a', 'no');
    expect(filasDeFormulario(datos)).toEqual([]);
  });
});
