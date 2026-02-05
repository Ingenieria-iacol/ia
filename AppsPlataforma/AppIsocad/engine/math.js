/**
 * engine/math.js
 * Motor matemático para proyecciones y conversiones
 */
window.CADMath = {
    // Proyecta puntos 3D a 2D
    isoToScreen: function(x, y, z) {
        const angle = window.estado.view.angle; // Lee el ángulo actual
        const tileW = window.CONFIG.tileW;
        const tileH = window.CONFIG.tileH;

        const nx = x * Math.cos(angle) - y * Math.sin(angle);
        const ny = x * Math.sin(angle) + y * Math.cos(angle);

        return {
            x: nx * tileW,
            y: (ny * tileH) - (z * tileW * 0.7) 
        };
    },

    // Convierte clics a coordenadas 3D (Z=0)
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

    getDistance3D: function(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2) + 
            Math.pow(p2.z - p1.z, 2)
        );
    }
};
