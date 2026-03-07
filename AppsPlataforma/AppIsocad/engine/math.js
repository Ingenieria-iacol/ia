/**
 * engine/math.js
 */
window.CADMath = {
    /**
     * Proyección Isométrica Estándar (2:1) con soporte de rotación de cámara.
     */
    isoToScreen: function(x, y, z) {
        const angle = window.estado.view.angle; // Ángulo de rotación de cámara
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // Rotación en el plano XY antes de proyectar a Isométrico
        const rotX = x * Math.cos(angle) - y * Math.sin(angle);
        const rotY = x * Math.sin(angle) + y * Math.cos(angle);

        // Proyección Isométrica estándar 2:1
        const screenX = (rotX - rotY) * (tileW / 2);
        const screenY = (rotX + rotY) * (tileH / 2) - (z * tileH);

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
