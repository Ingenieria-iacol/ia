/**
 * engine/math.js
 */
window.CADMath = {
    /**
     * Proyección Isométrica Estándar (2:1)
     * Forzamos el ángulo para evitar desviaciones y asegurar consistencia visual.
     */
    isoToScreen: function(x, y, z) {
        const tileW = window.CONFIG.tileW; // Base 100px
        const tileH = window.CONFIG.tileH; // Base 50px

        // x_screen = (x - y) * (tileW / 2)
        // y_screen = (x + y) * (tileH / 2) - (z * tileH)
        const screenX = (x - y) * (tileW / 2);
        const screenY = (x + y) * (tileH / 2) - (z * tileH);

        return { x: screenX, y: screenY };
    },

    /**
     * Convierte coordenadas de pantalla a isométricas (Inversa de isoToScreen)
     * Basado en la proyección estándar 2:1.
     */
    screenToIso: function(sx, sy) {
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // Inversión matricial de la proyección estándar
        const isoX = (sx / (tileW / 2) + sy / (tileH / 2)) / 2;
        const isoY = (sy / (tileH / 2) - sx / (tileW / 2)) / 2;

        return { x: isoX, y: isoY };
    },

    getDistance3D: function(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2) + 
            Math.pow(p2.z - p1.z, 2)
        );
    }
};
