/**
 * js/renderer.js
 * Responsable de la representación gráfica en el SVG
 */

window.CADRenderer = {
    // Referencias a las capas del SVG definidas en el index.html
    capas: {
        grid: document.getElementById('grid-layer'),
        elementos: document.getElementById('elements-layer'),
        ui: document.getElementById('ui-layer')
    },

    /**
     * Limpia y redibuja toda la escena
     */
    dibujarEscena: function() {
        this.limpiarCapas();
        this.dibujarGrid();
        
        // Dibujamos cada elemento que existe en el Core
        window.AppCore.elementos.forEach(el => {
            if (!el.visible) return;
            
            if (el.tipo === 'tuberia') {
                this.dibujarTuberia(el);
            } else {
                this.dibujarEquipo(el);
            }
        });

        this.actualizarTransformacion();
    },

    /**
     * Dibuja una tubería (Línea isométrica)
     */
    dibujarTuberia: function(el) {
        const inicio = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const fin = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        
        const linea = document.createElementNS("http://www.w3.org/2000/svg", "line");
        linea.setAttribute("x1", inicio.x);
        linea.setAttribute("y1", inicio.y);
        linea.setAttribute("x2", fin.x);
        linea.setAttribute("y2", fin.y);
        
        // Estética profesional
        const color = el.props.customColor || "#FFD700";
        const grosor = window.Utils.parseInput(el.props.grosor) || 2;
        
        linea.setAttribute("stroke", color);
        linea.setAttribute("stroke-width", grosor);
        linea.setAttribute("stroke-linecap", "round");
        
        // Si está seleccionado, le ponemos un brillo (halo)
        if (window.AppCore.seleccion.includes(el.id)) {
            linea.setAttribute("filter", "drop-shadow(0 0 5px #0071eb)");
        }

        this.capas.elementos.appendChild(linea);
    },

    /**
     * Dibuja equipos o válvulas usando sus iconos
     */
    dibujarEquipo: function(el) {
        const pos = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Si el elemento tiene un icono SVG en el catálogo
        if (el.icon) {
            const temp = document.createElement('div');
            temp.innerHTML = el.icon;
            const svgIcon = temp.querySelector('svg');
            
            if (svgIcon) {
                const size = 30 * (el.props.scaleFactor || 1);
                svgIcon.setAttribute("width", size);
                svgIcon.setAttribute("height", size);
                svgIcon.setAttribute("x", pos.x - size/2);
                svgIcon.setAttribute("y", pos.y - size/2);
                svgIcon.setAttribute("stroke", el.props.color || "#ccc");
                g.appendChild(svgIcon);
            }
        }

        this.capas.elementos.appendChild(g);
    },

    /**
     * Aplica el zoom y el movimiento de cámara (Pan)
     */
    actualizarTransformacion: function() {
        const world = document.getElementById('world-transform');
        const v = window.estado.view;
        world.setAttribute('transform', `translate(${v.x}, ${v.y}) scale(${v.scale})`);
        
        // Actualizamos el HUD del index.html
        document.getElementById('hud-scale').innerText = Math.round(v.scale * 100);
    },

    limpiarCapas: function() {
        this.capas.elementos.innerHTML = '';
        // No limpiamos el grid siempre para ahorrar procesador
    },

    dibujarGrid: function() {
        // Aquí podrías mover tu lógica de dibujar las líneas de fondo
    }
};
