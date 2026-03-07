/**
 * engine/math.js
 * Sistema de coordenadas isométricas con soporte para rotación de cámara y zoom.
 */
window.CADMath = {
    /**
     * Proyección Isométrica: Mundo (x, y, z) -> Pantalla (px, py)
     */
    isoToScreen: function(x, y, z = 0) {
        const v = window.estado.view;
        const config = window.CONFIG;
        const angle = v.angle || 0;
        const zoom = v.zoom || 1;

        // 1. Rotación horizontal (sobre el eje Z)
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const rotX = x * cosA - y * sinA;
        const rotY = x * sinA + y * cosA;

        // 2. Proyección Isométrica con Zoom y Escala de Tile
        // (rotX - rotY) define el eje horizontal de la pantalla
        // (rotX + rotY) define el eje vertical, restando Z para la altura
        const screenX = (rotX - rotY) * (config.tileW / 2) * zoom;
        const screenY = ((rotX + rotY) * (config.tileH / 2) - (z * config.tileH)) * zoom;

        // 3. Retornar posición sumando el desplazamiento de cámara (offset)
        return {
            x: screenX + v.x,
            y: screenY + v.y
        };
    },

    /**
     * Proyección Inversa: Pantalla (px, py) -> Mundo (x, y)
     * Nota: Asume z = 0 para el cálculo de suelo.
     */
    screenToIso: function(sx, sy) {
        const v = window.estado.view;
        const config = window.CONFIG;
        const angle = v.angle || 0;
        const zoom = v.zoom || 1;

        // 1. Revertir desplazamiento de cámara y zoom
        const posX = (sx - v.x) / zoom;
        const posY = (sy - v.y) / zoom;

        // 2. Invertir la proyección Isométrica para obtener coordenadas rotadas
        const rotX = (posX / (config.tileW / 2) + posY / (config.tileH / 2)) / 2;
        const rotY = (posY / (config.tileH / 2) - posX / (config.tileW / 2)) / 2;

        // 3. Invertir la rotación (aplicando el ángulo opuesto)
        const cosA = Math.cos(-angle);
        const sinA = Math.sin(-angle);

        return {
            x: rotX * cosA - rotY * sinA,
            y: rotX * sinA + rotY * cosA
        };
    },

    /**
     * Distancia euclidiana en el espacio 3D
     */
    getDistance3D: function(p1, p2) {
        return Math.sqrt(
            Math.pow((p2.x || 0) - (p1.x || 0), 2) + 
            Math.pow((p2.y || 0) - (p1.y || 0), 2) + 
            Math.pow((p2.z || 0) - (p1.z || 0), 2)
        );
    }
};
