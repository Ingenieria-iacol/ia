/**
 * engine/math.js
 */
window.CADMath = {
    isoToScreen: function(x, y, z) {
        // Protección: Si el estado no existe, usar valores por defecto
        const view = window.estado ? window.estado.view : { angle: Math.PI/6 };
        const config = window.CONFIG || { tileW: 100, tileH: 50 };

        const angle = view.angle;
        const nx = x * Math.cos(angle) - y * Math.sin(angle);
        const ny = x * Math.sin(angle) + y * Math.cos(angle);

        return {
            x: nx * config.tileW,
            y: (ny * config.tileH) - (z * config.tileW * 0.7) 
        };
    },

    screenToIso: function(sx, sy) {
        const view = window.estado ? window.estado.view : { angle: Math.PI/6 };
        const config = window.CONFIG || { tileW: 100, tileH: 50 };

        const nx = sx / config.tileW;
        const ny = sy / config.tileH;

        return {
            x: nx * Math.cos(-view.angle) - ny * Math.sin(-view.angle),
            y: nx * Math.sin(-view.angle) + ny * Math.cos(-view.angle)
        };
    }
};
