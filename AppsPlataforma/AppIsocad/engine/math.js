/**
 * engine/math.js
 */
window.CADMath = {
    isoToScreen: function(x, y, z) {
        const angle = window.estado.view.angle;
        const config = window.CONFIG;
        // Rotación de matriz isométrica
        const nx = x * Math.cos(angle) - y * Math.sin(angle);
        const ny = x * Math.sin(angle) + y * Math.cos(angle);
        return {
            x: nx * config.tileW,
            y: (ny * config.tileH) - (z * config.tileW * 0.7) 
        };
    },

    screenToIso: function(sx, sy) {
        const angle = window.estado.view.angle;
        const config = window.CONFIG;
        const nx = sx / config.tileW;
        const ny = sy / config.tileH;
        return {
            x: nx * Math.cos(-angle) - ny * Math.sin(-angle),
            y: nx * Math.sin(-angle) + ny * Math.cos(-angle)
        };
    }
};
