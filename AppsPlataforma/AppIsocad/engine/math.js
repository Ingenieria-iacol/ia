/**
 * engine/math.js
 * Motor matemático para proyecciones dinámicas y conversiones
 */
window.CADMath = {
    /**
     * Proyecta puntos 3D a 2D usando el ángulo actual del estado
     */
    isoToScreen: function(x, y, z) {
        // Leemos el ángulo dinámicamente del estado global
        const angle = window.estado.view.angle;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // Rotación de coordenadas en el plano X-Y
        const nx = x * Math.cos(angle) - y * Math.sin(angle);
        const ny = x * Math.sin(angle) + y * Math.cos(angle);

        return {
            x: nx * tileW,
            // La elevación Z afecta la posición Y en pantalla (factor de escala 0.7 para realismo)
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

        // Inversa de la rotación para hallar la posición en el espacio del modelo
        return {
            x: nx * Math.cos(-angle) - ny * Math.sin(-angle),
            y: nx * Math.sin(-angle) + ny * Math.cos(-angle)
        };
    },

    getDistance3D: function(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2) + 
            Math.pow(p2.z - p1.z, 2)
        );
    }
};
