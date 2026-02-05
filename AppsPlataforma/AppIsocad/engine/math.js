/**
 * js/engine/math.js
 * Motor matemático para proyecciones y conversiones
 */
window.CADMath = {
    // Configuración de ángulos para la vista isométrica profesional
    // Usamos 30 grados (0.523 rad) para una verdadera proyección isométrica
    ANGLE: Math.PI / 6, 

    /**
     * Proyecta puntos 3D (espacio del modelo) a 2D (pantalla SVG)
     * @param {number} x, y, z - Coordenadas en metros
     * @returns {object} {x, y} en pixeles
     */
    isoToScreen: function(x, y, z) {
        const angle = window.estado.view.angle;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // Rotación de coordenadas basada en el ángulo de visión
        const nx = x * Math.cos(angle) - y * Math.sin(angle);
        const ny = x * Math.sin(angle) + y * Math.cos(angle);

        // La altura (z) afecta verticalmente con un factor de escala
        return {
            x: nx * tileW,
            y: (ny * tileH) - (z * tileW * 0.7) 
        };
    },

    /**
     * Convierte clics de pantalla a coordenadas del plano base (z=0)
     */
    screenToIso: function(sx, sy) {
        const angle = window.estado.view.angle;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        const nx = sx / tileW;
        const ny = sy / tileH;

        return {
            x: nx * Math.cos(-angle) - ny * Math.sin(-angle),
            y: nx * Math.sin(-angle) + ny * Math.cos(-angle)
        };
    },

    /**
     * Calcula la distancia real entre dos puntos en el espacio 3D
     */
    getDistance3D: function(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2) + 
            Math.pow(p2.z - p1.z, 2)
        );
    }
};
