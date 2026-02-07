/**
 * js/renderer.js - VERSIÓN: RENDERIZADO CARDINAL
 */
window.CADRenderer = {
    capas: {
        grid: document.getElementById('grid-layer'),
        elementos: document.getElementById('elements-layer'),
        ui: document.getElementById('ui-layer')
    },

    dibujarEscena: function() {
        if (!this.capas.grid || !this.capas.elementos) return;
        this.capas.grid.innerHTML = '';
        this.capas.elementos.innerHTML = '';
        this.dibujarGrid();
        window.AppCore.elementos.forEach(el => {
            if (el.tipo === 'tuberia') this.dibujarTuberia(el);
            else this.dibujarEquipo(el);
        });
        this.actualizarTransformacion();
    },

    dibujarGrid: function() {
        const grid = this.capas.grid;
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
        const isSel = window.AppCore.seleccion.includes(el.id);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x); line.setAttribute("y2", e.y);
        let color = isSel ? "#0071eb" : (el.dz !== 0 || el.props.isVertical ? "#00ff00" : "#ffd700");
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", isSel ? "5" : "3");
        line.setAttribute("stroke-linecap", "round");
        this.capas.elementos.appendChild(line);
        if (el.props.longitudManual) {
            const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txt.setAttribute("x", (s.x + e.x) / 2); txt.setAttribute("y", (s.y + e.y) / 2 - 8);
            txt.setAttribute("fill", "white"); txt.setAttribute("font-size", "10px");
            txt.setAttribute("text-anchor", "middle"); txt.textContent = el.props.longitudManual + "m";
            this.capas.elementos.appendChild(txt);
        }
    },

    dibujarEquipo: function(el) {
        const p = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const escala = el.props.escala || 1;
        const size = 32 * escala;
        const viewDeg = (window.estado.view.angle * 180) / Math.PI;
        const rotFinal = (el.props.rotacionAxial || 0) + viewDeg;
        const isSel = window.AppCore.seleccion.includes(el.id);
        const color = isSel ? '#0071eb' : (el.props.colorRef || '#ffffff');

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${p.x}, ${p.y}) rotate(${rotFinal})`);
        
        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", -size/2); foreignObj.setAttribute("y", -size/2); 
        foreignObj.setAttribute("width", size); foreignObj.setAttribute("height", size);
        
        let iconHTML = window.ICONS.SOPORTE;
        if (el.idCatalogo) {
            const idKey = el.idCatalogo.toUpperCase();
            iconHTML = window.ICONS[idKey] || window.ICONS[idKey.split('_').pop()] || window.ICONS.SOPORTE;
        }

        foreignObj.innerHTML = `
            <div style="color:${color}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; filter:${isSel ? 'drop-shadow(0 0 3px #0071eb)' : 'none'};">
                ${iconHTML}
            </div>`;
        group.appendChild(foreignObj);
        this.capas.elementos.appendChild(group);

        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", p.x); txt.setAttribute("y", p.y + (size/2) + 12);
        txt.setAttribute("fill", isSel ? "#0071eb" : "#888"); txt.setAttribute("font-size", "9px");
        txt.setAttribute("text-anchor", "middle"); txt.textContent = el.props.tag || el.props.name || "";
        this.capas.elementos.appendChild(txt);
    },

    actualizarTransformacion: function() {
        const world = document.getElementById('world-transform');
        if (world) {
            const v = window.estado.view;
            world.setAttribute('transform', `translate(${v.x}, ${v.y}) scale(${v.scale})`);
        }
        const hudZ = document.getElementById('hud-z');
        const hudScale = document.getElementById('hud-scale');
        if (hudZ) hudZ.innerText = window.estado.currentZ.toFixed(2);
        if (hudScale) hudScale.innerText = Math.round(window.estado.view.scale * 100);
    }
};
