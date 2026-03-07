/**
 * engine/math.js
 */
window.CADMath = {
    /**
     * Proyección Isométrica Estándar (2:1) con soporte de rotación de cámara.
     */
    isoToScreen: function(x, y, z) {
        const angle = window.estado.view.angle || 0; // Ángulo de rotación de cámara
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // 1. Rotación horizontal (Plano XY)
        const rotX = x * Math.cos(angle) - y * Math.sin(angle);
        const rotY = x * Math.sin(angle) + y * Math.cos(angle);

        // 2. Proyección Isométrica 2:1
        // (rotX - rotY) define la horizontal, (rotX + rotY) define la profundidad visual
        const screenX = (rotX - rotY) * (tileW / 2);
        const screenY = (rotX + rotY) * (tileH / 2) - (z * tileH);

        return { x: screenX, y: screenY };
    },

    /**
     * Convierte coordenadas de pantalla a isométricas (Inversa de isoToScreen)
     * Ahora incluye la des-rotación de la cámara.
     */
    screenToIso: function(sx, sy) {
        const angle = window.estado.view.angle || 0;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // 1. Invertir la proyección Isométrica (obtenemos rotX y rotY)
        const rotX = (sx / (tileW / 2) + sy / (tileH / 2)) / 2;
        const rotY = (sy / (tileH / 2) - sx / (tileW / 2)) / 2;

        // 2. Invertir la rotación (Rotación con ángulo negativo)
        // La matriz inversa de rotación usa el ángulo negativo
        const cosA = Math.cos(-angle);
        const sinA = Math.sin(-angle);

        const x = rotX * cosA - rotY * sinA;
        const y = rotX * sinA + rotY * cosA;

        return { x: x, y: y };
    },

    getDistance3D: function(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2) + 
            Math.pow(p2.z - p1.z, 2)
        );
    }
};
