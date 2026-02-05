/**
 * js/engine/calc.js
 * Lógica de ingeniería y cálculos hidráulicos
 */
window.GasEngine = {
    // Gravedad específica por tipo de gas
    GAS_PROPERTIES: {
        'NATURAL': 0.60,
        'GLP': 1.52
    },

    /**
     * Convierte diámetros comerciales (pulgadas o mm) a metros reales para cálculos
     * @param {string} diamStr - Ejemplo: '1/2"' o '25mm'
     * @returns {number} Diámetro en metros
     */
    getInternalDiameter: function(diamStr) {
        if (!diamStr) return 0.0127; // 1/2" por defecto si hay error

        if (diamStr.includes('"')) {
            const parts = diamStr.replace('"', '').split('/');
            const inches = parts.length === 2 ? 
                parseFloat(parts[0]) / parseFloat(parts[1]) : 
                parseFloat(parts[0]);
            return inches * 0.0254; // Convertir pulgadas a metros
        } 
        
        if (diamStr.toLowerCase().includes('mm')) {
            return parseFloat(diamStr) / 1000; // Convertir mm a metros
        }

        return parseFloat(diamStr);
    },

    /**
     * Ejecuta el cálculo de Mueller (Aproximación para redes de gas)
     * @param {object} p - Parámetros: diamNominal, longitud, caudal, tipoGas, presionEntrada
     */
    calculateFlow: function(p) {
        const D = this.getInternalDiameter(p.diamNominal);
        const L = p.longitud <= 0 ? 0.001 : p.longitud;
        const S = this.GAS_PROPERTIES[p.tipoGas.toUpperCase()] || 0.60;
        
        // Diámetro en pulgadas para la fórmula estándar de Mueller
        const D_inches = D / 0.0254;

        // Fórmula de caída de presión (mbar)
        // DeltaP = (Q^2 * L * S) / (1000 * D^5)
        const drop = (Math.pow(p.caudal, 2) * L * S) / (1000 * Math.pow(D_inches, 5));
        
        // Cálculo de Velocidad (m/s)
        const area = Math.PI * Math.pow(D / 2, 2);
        const velocity = (p.caudal / 3600) / area;

        // Evaluación de estado según velocidad
        let status = "OK";
        if (velocity > 20) status = "ALERTA";
        if (velocity > 30) status = "CRÍTICO";

        return {
            caidaPresion: drop,
            caidaPresionStr: drop.toFixed(4) + " mbar",
            porcentajeCaida: ((drop / p.presionEntrada) * 100).toFixed(2) + "%",
            velocidad: velocity.toFixed(2) + " m/s",
            presionSalida: (p.presionEntrada - drop).toFixed(2),
            estado: status,
            alerta: (velocity > 20) ? "Velocidad fuera de norma (>20m/s)" : ""
        };
    }
};
