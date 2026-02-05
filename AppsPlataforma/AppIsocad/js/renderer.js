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
        this.limpiarCapas();
        this.dibujarGrid();
        window.AppCore.elementos.forEach(el => {
            if (el.tipo === 'tuberia') this.dibujarTuberia(el);
            else this.dibujarEquipo(el);
        });
        this.actualizarTransformacion();
    },

    dibujarGrid: function() {
        const grid = this.capas.grid; grid.innerHTML = '';
        const tam = 15; let d = "";
        for (let i = -tam; i <= tam; i++) {
            let p1 = window.CADMath.isoToScreen(-tam, i, 0);
            let p2 = window.CADMath.isoToScreen(tam, i, 0);
            d += `M${p1.x},${p1.y} L${p2.x},${p2.y} `;
            let p3 = window.CADMath.isoToScreen(i, -tam, 0);
            let p4 = window.CADMath.isoToScreen(i, tam, 0);
            d += `M${p3.x},${p3.y} L${p4.x},${p4.y} `;
        }
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d); path.setAttribute("stroke", "#222"); path.setAttribute("fill", "none");
        grid.appendChild(path);
    },

    dibujarTuberia: function(el) {
        const s = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const e = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x); line.setAttribute("y2", e.y);
        line.setAttribute("stroke", window.AppCore.seleccion.includes(el.id) ? "#0071eb" : (el.props.isVertical ? "#00ff00" : "#ffd700"));
        line.setAttribute("stroke-width", "2.5");
        this.capas.elementos.appendChild(line);

        if (el.props.longitudManual) {
            const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txt.setAttribute("x", (s.x + e.x) / 2); txt.setAttribute("y", (s.y + e.y) / 2 - 5);
            txt.setAttribute("fill", "white"); txt.setAttribute("font-size", "10px");
            txt.setAttribute("text-anchor", "middle"); txt.textContent = el.props.longitudManual + "m";
            this.capas.elementos.appendChild(txt);
        }
    },

    dibujarEquipo: function(el) {
        const p = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const size = 32;
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${p.x - size/2}, ${p.y - size/2})`);
        
        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("width", size); foreignObj.setAttribute("height", size);
        const iconHTML = window.ICONS[el.props.tipo?.replace('c_', '').replace('v_', '').replace('eq_', '').toUpperCase()] || window.ICONS.SOPORTE;
        foreignObj.innerHTML = `<div style="color:${window.AppCore.seleccion.includes(el.id) ? '#0071eb' : '#fff'}; width:100%; height:100%;">${iconHTML}</div>`;
        
        group.appendChild(foreignObj);
        this.capas.elementos.appendChild(group);
    },

    actualizarTransformacion: function() {
        const world = document.getElementById('world-transform');
        if (world) {
            const v = window.estado.view;
            world.setAttribute('transform', `translate(${v.x}, ${v.y}) scale(${v.scale})`);
        }
        document.getElementById('hud-z').innerText = window.estado.currentZ.toFixed(2);
    },

    limpiarCapas: function() {
        this.capas.elementos.innerHTML = '';
        this.capas.ui.innerHTML = '';
    }
};
