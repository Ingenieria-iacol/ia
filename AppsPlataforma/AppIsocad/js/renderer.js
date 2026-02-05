/**
 * js/renderer.js
 */
window.CADRenderer = {
    capas: {
        grid: document.getElementById('grid-layer'),
        elementos: document.getElementById('elements-layer'),
        ui: document.getElementById('ui-layer')
    },

    dibujarEscena: function() {
        if (!this.capas.grid) {
            // Re-vincular si el DOM no estaba listo
            this.capas.grid = document.getElementById('grid-layer');
            this.capas.elementos = document.getElementById('elements-layer');
            this.capas.ui = document.getElementById('ui-layer');
        }
        
        this.limpiarCapas();
        this.dibujarGrid();
        
        if (window.AppCore && window.AppCore.elementos) {
            window.AppCore.elementos.forEach(el => {
                if (el.tipo === 'tuberia') this.dibujarTuberia(el);
            });
        }
        this.actualizarTransformacion();
    },

    dibujarGrid: function() {
        const grid = this.capas.grid;
        if (!grid) return;
        
        let d = "";
        const tam = 20; // 20 metros de rejilla

        for (let i = -tam; i <= tam; i++) {
            let p1 = window.CADMath.isoToScreen(-tam, i, 0);
            let p2 = window.CADMath.isoToScreen(tam, i, 0);
            d += `M${p1.x},${p1.y} L${p2.x},${p2.y} `;

            let p3 = window.CADMath.isoToScreen(i, -tam, 0);
            let p4 = window.CADMath.isoToScreen(i, tam, 0);
            d += `M${p3.x},${p3.y} L${p4.x},${p4.y} `;
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke", "#333");
        path.setAttribute("fill", "none");
        grid.appendChild(path);
    },

    dibujarTuberia: function(el) {
        const s = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const e = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x); line.setAttribute("y2", e.y);
        line.setAttribute("stroke", el.props.customColor || "#FFD700");
        line.setAttribute("stroke-width", "3");
        line.setAttribute("stroke-linecap", "round");
        this.capas.elementos.appendChild(line);
    },

    actualizarTransformacion: function() {
        const world = document.getElementById('world-transform');
        if (world && window.estado) {
            const v = window.estado.view;
            world.setAttribute('transform', `translate(${v.x}, ${v.y}) scale(${v.scale})`);
        }
    },

    limpiarCapas: function() {
        if (this.capas.elementos) this.capas.elementos.innerHTML = '';
        if (this.capas.ui) this.capas.ui.innerHTML = '';
    }
};
