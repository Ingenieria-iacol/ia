/**
 * engine/math.js - Refactorizado para Proyección Dinámica
 */
window.CADMath = {
    isoToScreen: function(x, y, z) {
        // Obtenemos el ángulo actual del estado (por defecto 45° o Math.PI/4)
        const angle = window.estado.view.angle || Math.PI / 4;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // Proyección Isométrica Proporcional
        // nx y ny rotan el plano base
        const nx = x * Math.cos(angle) - y * Math.sin(angle);
        const ny = x * Math.sin(angle) + y * Math.cos(angle);

        return {
            x: nx * tileW,
            // Aplicamos la profundidad (y) y la elevación (z)
            // El factor 0.7 es la relación de aspecto visual de la elevación
            y: (ny * tileH) - (z * (tileW * 0.7)) 
        };
    },

    screenToIso: function(sx, sy) {
        const angle = window.estado.view.angle || Math.PI / 4;
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        // Inversa de la rotación para detectar coordenadas de plano
        const nx = sx / tileW;
        const ny = sy / tileH;

        return {
            x: nx * Math.cos(-angle) - ny * Math.sin(-angle),
            y: nx * Math.sin(-angle) + ny * Math.cos(-angle)
        };
    }
};

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
