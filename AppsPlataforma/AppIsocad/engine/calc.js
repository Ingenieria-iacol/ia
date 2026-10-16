/**
 * engine/calc.js - Motor de cálculo de tramos (GasEngine)
 *
 * Este archivo contenía por error una copia antigua de iu/props.js y window.GasEngine no existía,
 * por lo que el "Reporte PDF" (io/pdf-export.js) fallaba. Se restituye el motor con la misma
 * ecuación que usan los demás modeladores de ENTALPÍA LAB:
 *
 *   ΔP [mbar] = 2,43·10^7 · S · L[m] · Q[m³/h]^1,82 / (D[mm]^4,82 · P_abs[mbar])
 *   (Renouard cuadrático linealizado; a baja presión equivale a ΔP = 23 200 · S · L · Q^1,82 · D^-4,82)
 *   V [m/s] = Q_real / A,  con  Q_real = Q · 1 013,25 / P_abs
 *
 * Criterio de estado: ΔP del tramo ≤ 10 % de la presión de entrada y V ≤ 20 m/s.
 */
window.GasEngine = (function () {
    'use strict';

    const GASES = {
        NATURAL: { S: 0.67, nombre: 'Gas natural' },
        GLP: { S: 1.52, nombre: 'GLP' }
    };
    const P_ATM = 1013.25;      // mbar (nivel del mar; a mayor altitud el resultado es levemente conservador)
    const V_MAX = 20;           // m/s
    const CAIDA_MAX = 0.10;     // fracción de la presión de entrada

    // Diámetros INTERNOS (mm) por material y diámetro nominal
    const DI = {
        acero_sch40: { '1/4"': 9.25, '1/2"': 15.80, '3/4"': 20.93, '1"': 26.64, '1-1/4"': 35.05, '1-1/2"': 40.89, '2"': 52.50, '2-1/2"': 62.71, '3"': 77.92, '4"': 102.26, '6"': 154.05 },
        acero_sch80: { '1/2"': 13.87, '3/4"': 18.85, '1"': 24.31, '1-1/4"': 32.46, '1-1/2"': 38.10, '2"': 49.25, '3"': 73.66, '4"': 97.18 },
        acero_sch160: { '1/2"': 11.79, '3/4"': 15.54, '1"': 20.70, '2"': 42.85 },
        cobre_k: { '3/8"': 10.21, '1/2"': 13.39, '5/8"': 16.56, '3/4"': 18.92, '1"': 25.27, '1-1/4"': 31.62, '1-1/2"': 37.62, '2"': 49.76 },
        cobre_l: { '1/4"': 8.00, '3/8"': 10.92, '1/2"': 13.84, '5/8"': 16.92, '3/4"': 19.94, '1"': 26.04, '1-1/4"': 32.13, '1-1/2"': 38.23, '2"': 50.42 },
        cobre_m: { '3/8"': 11.43, '1/2"': 14.45, '3/4"': 20.60, '1"': 26.80, '1-1/4"': 32.80, '1-1/2"': 39.09, '2"': 51.36 },
        cobre_flex: { '1/8"': 1.65, '3/16"': 3.24, '1/4"': 4.83, '5/16"': 6.42, '3/8"': 8.00, '1/2"': 11.18, '5/8"': 14.10, '3/4"': 17.27 },
        multicapa: { '1216 (16mm)': 12, '1620 (20mm)': 16, '2025 (25mm)': 20, '2632 (32mm)': 26, '4050 (50mm)': 40 },
        pe_ips: { '1/2" IPS': 17.4, '3/4" IPS': 21.8, '1" IPS': 27.3, '1-1/4" IPS': 34.5, '2" IPS': 49.4, '3" IPS': 72.7, '4" IPS': 93.5 },
        pe_cts: { '1/2" CTS': 11.3, '1" CTS': 23.4 },
        pe_metric: { '20mm': 16.0, '25mm': 20.4, '32mm': 26.2, '40mm': 32.6, '50mm': 40.8, '63mm': 51.4, '90mm': 73.6, '110mm': 90.0, '160mm': 130.8 }
    };
    DI.galv_sch40 = DI.acero_sch40; DI.galv_sch80 = DI.acero_sch80; DI.galv_sch160 = DI.acero_sch160;
    const ALIAS = { acero: 'acero_sch40', cobre: 'cobre_l', pe: 'pe_ips' };

    function diametroInterno(nominal, material) {
        const mat = ALIAS[material] || material;
        if (mat && DI[mat] && DI[mat][nominal]) return DI[mat][nominal];
        for (const k of ['acero_sch40', 'cobre_l', 'multicapa', 'pe_ips', 'pe_metric', 'cobre_flex']) if (DI[k][nominal]) return DI[k][nominal];
        // Último recurso: interpretar el nominal en pulgadas ("1-1/4"", "3/4"") y aproximar el interno al 80 %
        const m = String(nominal || '').match(/(\d+)(?:-(\d+)\/(\d+))?|(\d+)\/(\d+)/);
        if (!m) return 0;
        const pulg = m[4] ? (+m[4] / +m[5]) : (+m[1] + (m[2] ? +m[2] / +m[3] : 0));
        return pulg * 25.4 * 0.8;
    }

    function calculateFlow(o) {
        o = o || {};
        const gas = GASES[o.tipoGas] || GASES.NATURAL;
        const Q = Math.max(0, Number(o.caudal) || 0);
        const L = Math.max(0, Number(o.longitud) || 0);
        const P = Math.max(0, Number(o.presionEntrada) || 0);
        const D = diametroInterno(o.diamNominal, o.material);
        const pAbs = P + P_ATM;
        let dP = 0, v = 0;
        if (D > 0 && Q > 0 && L > 0) dP = 2.43e7 * gas.S * L * Math.pow(Q, 1.82) / (Math.pow(D, 4.82) * pAbs);
        if (D > 0 && Q > 0) v = (Q / 3600) * (P_ATM / pAbs) / (Math.PI * Math.pow(D / 1000, 2) / 4);
        const frac = P > 0 ? dP / P : 0;
        const ok = D > 0 && frac <= CAIDA_MAX && v <= V_MAX;
        return {
            diametroInterno: D,
            caidaPresion: dP,
            caidaPresionStr: dP.toFixed(3) + ' mbar',
            porcentajeCaida: (frac * 100).toFixed(1) + ' %',
            velocidadNum: v,
            velocidad: v.toFixed(2) + ' m/s',
            presionSalida: P - dP,
            estado: !D ? 'SIN DIÁMETRO' : ok ? 'OK' : (v > V_MAX ? 'VELOCIDAD ALTA' : 'CAÍDA EXCESIVA')
        };
    }

    return { calculateFlow, diametroInterno, DI, V_MAX, CAIDA_MAX };
})();
