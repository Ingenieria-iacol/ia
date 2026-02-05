/**
 * js/renderer.js
 * Responsable de la representación gráfica en el SVG
 */

window.CADRenderer = {
    capas: {
        grid: document.getElementById('grid-layer'),
        elementos: document.getElementById('elements-layer'),
        ui: document.getElementById('ui-layer')
    },

    /**
     * Limpia y redibuja toda la escena (Rejilla + Elementos)
     */
    dibujarEscena: function() {
        this.limpiarCapas();
        this.dibujarGrid();
        
        // Dibujar elementos guardados en el Core
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
     * Dibuja la rejilla isométrica de fondo
     */
    dibujarGrid: function() {
        const grid = this.capas.grid;
        grid.innerHTML = '';
        const tamano = 20; // Extensión de la rejilla en metros
        let d = "";

        for (let i = -tamano; i <= tamano; i++) {
            // Líneas paralelas al eje X
            let p1 = window.CADMath.isoToScreen(-tamano, i, 0);
            let p2 = window.CADMath.isoToScreen(tamano, i, 0);
            d += `M${p1.x},${p1.y} L${p2.x},${p2.y} `;

            // Líneas paralelas al eje Y
            let p3 = window.CADMath.isoToScreen(i, -tamano, 0);
            let p4 = window.CADMath.isoToScreen(i, tamano, 0);
            d += `M${p3.x},${p3.y} L${p4.x},${p4.y} `;
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke", "#222"); // Color oscuro para que no moleste
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-width", "1");
        grid.appendChild(path);
    },

    /**
     * Dibuja una tubería fija
     */
    dibujarTuberia: function(el) {
        const s = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const e = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x);
        line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x);
        line.setAttribute("y2", e.y);
        
        // Estilo profesional
        const color = el.props.customColor || "#FFD700";
        const grosor = el.props.grosor || 2;
        
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", grosor);
        line.setAttribute("stroke-linecap", "round");
        
        if (window.AppCore.seleccion.includes(el.id)) {
            line.setAttribute("filter", "drop-shadow(0 0 5px #0071eb)");
            line.setAttribute("stroke-width", grosor + 2);
        }

        this.capas.elementos.appendChild(line);
    },

    /**
     * Actualiza el Zoom y Pan en la pantalla
     */
    actualizarTransformacion: function() {
        const world = document.getElementById('world-transform');
        const v = window.estado.view;
        world.setAttribute('transform', `translate(${v.x}, ${v.y}) scale(${v.scale})`);
        
        // Actualizar datos del HUD
        document.getElementById('hud-scale').innerText = Math.round(v.scale * 100);
        document.getElementById('hud-z').innerText = window.estado.currentZ.toFixed(2);
    },

    limpiarCapas: function() {
        this.capas.elementos.innerHTML = '';
        this.capas.ui.innerHTML = '';
    },

    dibujarEquipo: function(el) {
        // Lógica para iconos (puedes expandirla después)
    }
};
