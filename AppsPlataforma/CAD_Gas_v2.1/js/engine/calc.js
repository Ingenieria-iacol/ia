// js/engine/calc.js
window.GasEngine = {
    // Constantes de gravedad específica
    GRAVEDAD_ESPECIFICA: { NATURAL: 0.60, GLP: 1.52 },

    calcularMueller: function(params) {
        const { diametro, longitud, caudal, tipoGas, presionEntrada } = params;
        const S = this.GRAVEDAD_ESPECIFICA[tipoGas.toUpperCase()] || 0.60;
        
        // Convertir diámetro nominal a pulgadas reales
        let D = window.Utils.convertirDiametroADecimal(diametro);
        let L = longitud <= 0 ? 0.001 : longitud;

        // Fórmula de caída de presión (Simplificada Mueller)
        const drop = (caudal * caudal * L * S) / (1000 * Math.pow(D, 5));
        
        // Cálculo de velocidad (v = Q/A)
        const area = Math.PI * Math.pow((D * 0.0254)/2, 2);
        const vel = (caudal / 3600) / area;

        return {
            caida: drop,
            velocidad: vel,
            pSalida: Math.max(0, presionEntrada - drop),
            estado: vel > 30 ? "CRÍTICO" : (vel > 20 ? "ALERTA" : "OK")
        };
    }
};
