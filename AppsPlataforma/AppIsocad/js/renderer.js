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
        
        // Llamada a la función de transformación de cámara
        this.actualizarTransformacion();
    },

    dibujarGrid: function() {
        const grid = this.capas.grid;
        const view = window.estado.view;
        const zoom = view.zoom || 1; 
        
        // Culling y radio adaptativo
        const radioBase = 20; 
        const radioAdaptativo = Math.ceil(radioBase / zoom); 
        const radio = Math.min(radioAdaptativo, 100);

        let dMetros = "";
        
        for (let i = -radio; i <= radio; i++) {
            // Las coordenadas ya vienen rotadas por CADMath
            let p1 = window.CADMath.isoToScreen(i, -radio, 0);
            let p2 = window.CADMath.isoToScreen(i, radio, 0);
            dMetros += `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} `;

            let p3 = window.CADMath.isoToScreen(-radio, i, 0);
            let p4 = window.CADMath.isoToScreen(radio, i, 0);
            dMetros += `M ${p3.x} ${p3.y} L ${p4.x} ${p4.y} `;
        }

        this.crearPathGrid(dMetros, "#333", 0.5);
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
        
        // Lógica de cálculo de diámetro (Simplificada para brevedad)
        let pulg = 0.5;
        try {
            const limpia = diamStr.replace(/"/g, '').trim();
            if (limpia.includes('/')) {
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
        
        const longReal = Math.sqrt(Math.pow(el.dx||0, 2) + Math.pow(el.dy||0, 2) + Math.pow(el.dz||0, 2));
        const L = (el.props.longitudManual || longReal).toFixed(2);

        foreignObj.innerHTML = `
            <div class="tag-label" style="color:#fff; font-family:monospace; font-size:9px; background:rgba(0,0,0,0.8); padding:4px; border-radius:3px; border-left: 3px solid ${color}; pointer-events:auto;">
                <b>${el.props.tag || 'Tramo'}</b><br>
                ${diamStr} | ${L}m
            </div>
        `;
        this.capas.elementos.appendChild(foreignObj);
    },

    dibujarEquipo: function(el) {
        const p = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const tileW = window.CONFIG.tileW; 
        const size = (el.props.longitudReal || 0.1) * tileW * (el.props.escala || 1);
        
        // Nota: rotación del equipo sigue siendo necesaria para orientar el icono
        const rot = (el.props.rotacionAxial || 0); 
        const isSel = window.AppCore.seleccion.includes(el.id);
        let color = isSel ? '#0071eb' : (el.props.colorRef || '#00d4ff');

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

        foreignObj.innerHTML = `<div style="color:${color}; width:100%; height:100%;">${iconHTML}</div>`;
        group.appendChild(foreignObj);
        this.capas.elementos.appendChild(group);
    },

    /**
     * ACTUALIZACIÓN DE TRANSFORMACIÓN INTEGRADA
     * El 'rotate' se quita de aquí porque ya está incluido en la lógica de CADMath
     */
    actualizarTransformacion: function() {
        const contenedor = document.getElementById('capa-transformacion');
        if (contenedor) {
            const v = window.estado.view;
            const zoom = v.zoom || v.scale || 1;
            
            // IMPORTANTE: Quitamos el rotate() de aquí porque ya está en la matemática
            contenedor.setAttribute('transform', 
                `translate(${v.x}, ${v.y}) scale(${zoom})`
            );
        }

        // Actualización de HUD (Heads-Up Display)
        const hudZ = document.getElementById('hud-z');
        const hudScale = document.getElementById('hud-scale');
        if (hudZ) hudZ.innerText = window.estado.currentZ.toFixed(3);
        if (hudScale) {
            const zHUD = window.estado.view.zoom || 1;
            hudScale.innerText = Math.round(zHUD * 100);
        }
    }
};
