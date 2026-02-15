/**
 * js/renderer.js - MOTOR DE RENDERIZADO MÉTRICO DE ALTA PRECISIÓN
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
        const radio = 10; // Radio de 10 metros para el área de trabajo
        let dMetros = "";
        let dDecimetros = "";
        let dCentimetros = "";

        // Generamos líneas cada 0.01m (1cm) para máxima precisión visual al hacer zoom
        for (let i = -radio; i <= radio; i += 0.1) {
            let pos = Math.round(i * 10) / 10;
            let p1 = window.CADMath.isoToScreen(-radio, pos, 0);
            let p2 = window.CADMath.isoToScreen(radio, pos, 0);
            let p3 = window.CADMath.isoToScreen(pos, -radio, 0);
            let p4 = window.CADMath.isoToScreen(pos, radio, 0);

            let pathData = `M${p1.x},${p1.y} L${p2.x},${p2.y} M${p3.x},${p3.y} L${p4.x},${p4.y} `;

            if (Math.abs(pos % 1) < 0.01) {
                dMetros += pathData;      // Cada 1 metro
            } else if (Math.abs((pos * 10) % 5) < 0.1) {
                dDecimetros += pathData;  // Cada 50 centímetros
            } else {
                dCentimetros += pathData; // Cada 10 centímetros
            }
        }

        // 1. Centímetros: Líneas muy tenues y delgadas
        this.crearPathGrid(dCentimetros, "#1a1a1a", 0.2);
        // 2. Decímetros: Líneas intermedias
        this.crearPathGrid(dDecimetros, "#222", 0.4);
        // 3. Metros: Ejes principales más visibles
        this.crearPathGrid(dMetros, "#333", 0.8);
    },

    crearPathGrid: function(d, color, width) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", width);
        path.setAttribute("fill", "none");
        this.capas.grid.appendChild(path);
    },

    dibujarTuberia: function(el) {
        const s = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const e = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
        const isSel = window.AppCore.seleccion.includes(el.id);
        
        // --- PROPORCIÓN MÉTRICA CON AJUSTE ESTÉTICO ---
        const tileW = window.CONFIG.tileW; // 100px = 1m
        const diamStr = el.props.diamNominal || '1/2"';
        
        // Conversión precisa de pulgadas a metros
        let pulg = 0.5;
        if (diamStr.includes('-')) {
            const partes = diamStr.split('-');
            pulg = parseFloat(partes[0]) + (eval(partes[1].replace('"', '')) || 0);
        } else {
            pulg = parseFloat(diamStr) || 0.5;
        }

        const diamMetros = pulg * 0.0254;

        // Factor para equilibrar la visibilidad técnica con la estética
        // Un valor de 3.5 permite que 1/2" sea una línea clara pero no un bloque
        const factorEstetico = 2.5; 
        const grosorFinal = diamMetros * tileW * factorEstetico;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x); line.setAttribute("y2", e.y);
        
        let color = isSel ? "#0071eb" : (el.dz !== 0 || el.props.isVertical ? "#00ff00" : "#ffd700");
        line.setAttribute("stroke", color);
        
        // Aplicamos el grosor: si está seleccionado aumentamos un 30% para destacar
        line.setAttribute("stroke-width", isSel ? grosorFinal * 1.3 : grosorFinal);
        line.setAttribute("stroke-linecap", "round");
        
        this.capas.elementos.appendChild(line);
    },

    dibujarEquipo: function(el) {
        const p = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const tileW = window.CONFIG.tileW; 
        const size = (el.props.longitudReal || 0.1) * tileW * (el.props.escala || 1);
        const rot = (el.props.rotacionAxial || 0) + (window.estado.view.angle * 180 / Math.PI);
        const isSel = window.AppCore.seleccion.includes(el.id);
        const color = isSel ? '#0071eb' : (el.props.colorRef || '#ffffff');

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${p.x}, ${p.y}) rotate(${rot})`);
        
        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", -size/2); foreignObj.setAttribute("y", -size/2); 
        foreignObj.setAttribute("width", size); foreignObj.setAttribute("height", size);
        
        let iconHTML = window.ICONS.SOPORTE;
        if (el.idCatalogo) {
            const idKey = el.idCatalogo.split('_')[1]?.toUpperCase();
            iconHTML = window.ICONS[idKey] || window.ICONS.SOPORTE;
        }

        foreignObj.innerHTML = `
            <div style="color:${color}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#111; border:0.5px solid #333; box-sizing:border-box; filter:${isSel ? 'drop-shadow(0 0 3px #0071eb)' : 'none'};">
                ${iconHTML}
            </div>`;
        
        group.appendChild(foreignObj);
        this.capas.elementos.appendChild(group);

        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", p.x); txt.setAttribute("y", p.y + (size/2) + 12);
        txt.setAttribute("fill", isSel ? "#0071eb" : "#888"); txt.setAttribute("font-size", "9px");
        txt.setAttribute("text-anchor", "middle"); txt.textContent = el.props.tag || "";
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
        if (hudZ) hudZ.innerText = window.estado.currentZ.toFixed(3);
        if (hudScale) hudScale.innerText = Math.round(window.estado.view.scale * 100);
    }
};
