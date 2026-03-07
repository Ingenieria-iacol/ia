/**
 * engine/math.js
 */
window.CADMath = {
    /**
     * Proyección Isométrica con rotación, zoom y desplazamiento de cámara.
     */
    isoToScreen: function(x, y, z) {
        const v = window.estado.view;
        const angle = v.angle || 0;
        const zoom = v.zoom || 1;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // 1. Rotación horizontal (Eje Z estable)
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const rotX = x * cosA - y * sinA;
        const rotY = x * sinA + y * cosA;

        // 2. Proyección Isométrica con Zoom y Escala de Tile
        // Usamos (tileW / 2) para mantener la proporción 2:1 estándar
        const screenX = (rotX - rotY) * (tileW / 2) * zoom;
        const screenY = ((rotX + rotY) * (tileH / 2) - (z || 0) * tileH) * zoom;

        // 3. Aplicamos el desplazamiento de cámara (v.x, v.y)
        return {
            x: screenX + v.x,
            y: screenY + v.y
        };
    },

    /**
     * Convierte coordenadas de pantalla a isométricas (Inversa de isoToScreen)
     */
    screenToIso: function(sx, sy) {
        const v = window.estado.view;
        const angle = v.angle || 0;
        const zoom = v.zoom || 1;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // 1. Revertir desplazamiento de cámara y zoom
        const posX = (sx - v.x) / zoom;
        const posY = (sy - v.y) / zoom;

        // 2. Invertir la proyección Isométrica (obtenemos rotX y rotY)
        const rotX = (posX / (tileW / 2) + posY / (tileH / 2)) / 2;
        const rotY = (posY / (tileH / 2) - posX / (tileW / 2)) / 2;

        // 3. Invertir la rotación (usando el ángulo negativo)
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
