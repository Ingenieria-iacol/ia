/**
 * js/renderer.js - MOTOR DE RENDERIZADO MÉTRICO DE ALTA PRECISIÓN
 * Optimizado con Grid Dinámico (Culling) y etiquetas interactivas.
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
        grid.innerHTML = '';
        
        // 1. Obtener el centro de la vista actual y el nivel de zoom
        // Nota: Asegúrate de que window.estado.view.offset exista, 
        // de lo contrario usa window.estado.view.x/y
        const view = window.estado.view;
        const config = window.CONFIG;
        
        const centerX = -(view.x || 0) / (config.tileW * (view.scale || 1));
        const centerY = -(view.y || 0) / (config.tileH * (view.scale || 1));
        
        // 2. Definir un margen de renderizado (20 metros alrededor de la cámara)
        const margin = 20; 
        const minX = Math.floor(centerX - margin);
        const maxX = Math.ceil(centerX + margin);
        const minY = Math.floor(centerY - margin);
        const maxY = Math.ceil(centerY + margin);

        let dMetros = "";
        
        // Dibujar líneas en X (paralelas al eje Y)
        for (let x = minX; x <= maxX; x++) {
            let p1 = window.CADMath.isoToScreen(x, minY, 0);
            let p2 = window.CADMath.isoToScreen(x, maxY, 0);
            dMetros += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `;
        }

        // Dibujar líneas en Y (paralelas al eje X)
        for (let y = minY; y <= maxY; y++) {
            let p1 = window.CADMath.isoToScreen(minX, y, 0);
            let p2 = window.CADMath.isoToScreen(maxX, y, 0);
            dMetros += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `;
        }

        // 3. Crear el path visual usando tu método existente
        this.crearPathGrid(dMetros, "#444", 0.5);
    },

    crearPathGrid: function(d, color, width) {
        if (!d) return;
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
        
        const tileW = window.CONFIG.tileW; 
        const diamStr = el.props.diamNominal || '1/2"';
        
        // Parseo de pulgadas a metros para grosor real
        let pulg = 0.5;
        try {
            const limpia = diamStr.replace(/"/g, '').trim();
            if (limpia.includes('-')) {
                const partes = limpia.split('-');
                const fraccion = partes[1].split('/');
                pulg = parseFloat(partes[0]) + (parseFloat(fraccion[0]) / parseFloat(fraccion[1]));
            } else if (limpia.includes('/')) {
                const fraccion = limpia.split('/');
                pulg = parseFloat(fraccion[0]) / parseFloat(fraccion[1]);
            } else {
                pulg = parseFloat(limpia) || 0.5;
            }
        } catch (err) { pulg = 0.5; }

        const diamMetros = pulg * 0.0254;
        const grosorBase = diamMetros * tileW;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x); line.setAttribute("y2", e.y);
        
        let color = isSel ? "#0071eb" : (el.dz !== 0 || el.props.isVertical ? "#00ff00" : "#ffd700");
        
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", isSel ? grosorBase + 2 : grosorBase);
        line.setAttribute("stroke-linecap", "round");
        this.capas.elementos.appendChild(line);

        if (window.CONFIG.showTags) {
            this.dibujarEtiqueta(el, s, e, color, diamStr);
        }
    },

    // He extraído la etiqueta a su propio método para limpiar dibujarTuberia
    dibujarEtiqueta: function(el, s, e, color, diamStr) {
        const midX = (s.x + e.x) / 2;
        const midY = (s.y + e.y) / 2;
        const offX = el.props.tagOffX || 0;
        const offY = el.props.tagOffY || 0;

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", midX + offX);
        foreignObj.setAttribute("y", midY + offY);
        foreignObj.setAttribute("width", "130");
        foreignObj.setAttribute("height", "50");
        foreignObj.style.cursor = "move";
        
        const longReal = Math.sqrt(Math.pow(el.dx||0, 2) + Math.pow(el.dy||0, 2) + Math.pow(el.dz||0, 2));
        const L = (el.props.longitudManual || longReal).toFixed(2);
        const Q = el.props.caudal || 2.5;
        const P = el.props.presionEntrada || 19;

        foreignObj.innerHTML = `
            <div class="tag-label" 
                 style="color:#fff; font-family:monospace; font-size:9px; background:rgba(0,0,0,0.8); 
                        padding:4px; border-radius:3px; border:1px solid #555; pointer-events:auto; border-left: 3px solid ${color};">
                <b>${el.props.tag || 'Tramo'}</b><br>
                ${diamStr} | ${L}m | ${Q}m³/h<br>
                P: ${P} mbar
            </div>
        `;
        this.capas.elementos.appendChild(foreignObj);
    },

    dibujarEquipo: function(el) {
        const p = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const tileW = window.CONFIG.tileW; 
        const size = (el.props.longitudReal || 0.1) * tileW * (el.props.escala || 1);
        const rot = (el.props.rotacionAxial || 0) + (window.estado.view.angle * 180 / Math.PI);
        const isSel = window.AppCore.seleccion.includes(el.id);
        
        let color = isSel ? '#0071eb' : (el.props.colorRef || '#00d4ff');
        if (color === '#000000' || color === '#111111') color = '#00d4ff'; 

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${p.x}, ${p.y}) rotate(${rot})`);
        
        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", -size/2); 
        foreignObj.setAttribute("y", -size/2); 
        foreignObj.setAttribute("width", size); 
        foreignObj.setAttribute("height", size);
        
        let iconHTML = window.ICONS.SOPORTE;
        if (el.idCatalogo) {
            const idKey = el.idCatalogo.split('_')[1]?.toUpperCase();
            iconHTML = window.ICONS[idKey] || window.ICONS.SOPORTE;
        }

        foreignObj.innerHTML = `
            <div style="color:${color}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; filter:${isSel ? 'drop-shadow(0 0 5px #0071eb)' : 'drop-shadow(0 0 2px rgba(255,255,255,0.2))'};">
                ${iconHTML}
            </div>`;
        
        group.appendChild(foreignObj);
        this.capas.elementos.appendChild(group);

        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", p.x); 
        txt.setAttribute("y", p.y + (size/2) + 12);
        txt.setAttribute("fill", isSel ? "#0071eb" : "#aaa"); 
        txt.setAttribute("font-size", "10px");
        txt.setAttribute("font-weight", "bold");
        txt.setAttribute("text-anchor", "middle"); 
        txt.textContent = el.props.tag || "";
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
