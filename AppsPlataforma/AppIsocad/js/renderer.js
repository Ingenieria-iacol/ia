/**
 * js/renderer.js - MOTOR DE RENDERIZADO MÉTRICO DE ALTA PRECISIÓN
 * Optimizado: Las transformaciones se calculan por punto, no por contenedor global.
 */
window.CADRenderer = {
    capas: {
        grid: document.getElementById('grid-layer'),
        elementos: document.getElementById('elements-layer'),
        ui: document.getElementById('ui-layer')
    },

    dibujarEscena: function() {
        if (!this.capas.grid || !this.capas.elementos) return;
        
        // Limpieza de capas
        this.capas.grid.innerHTML = '';
        this.capas.elementos.innerHTML = '';
        
        // Dibujado de componentes
        this.dibujarGrid();
        
        window.AppCore.elementos.forEach(el => {
            if (el.tipo === 'tuberia') this.dibujarTuberia(el);
            else this.dibujarEquipo(el);
        });
        
        // Sincronización de la cámara
        this.actualizarTransformacion();
    },

    dibujarGrid: function() {
        const view = window.estado.view;
        const zoom = view.zoom || 1; 
        
        const radioBase = 20; 
        const radioAdaptativo = Math.ceil(radioBase / zoom); 
        const radio = Math.min(radioAdaptativo, 100);

        let dMetros = "";
        
        for (let i = -radio; i <= radio; i++) {
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

    /**
     * REPARACIÓN: dibujarTuberia integrada v7 -> v13
     * Se restaura la lógica de proyección y asignación de atributos directos.
     */
    dibujarTuberia: function(el) {
        if (!el.p1 || !el.p2) return;

        // 1. Proyección de coordenadas usando CADMath
        const start = window.CADMath.isoToScreen(el.p1.x, el.p1.y, el.p1.z || 0);
        const end = window.CADMath.isoToScreen(el.p2.x, el.p2.y, el.p2.z || 0);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        
        // 2. Definición de Atributos Geométricos
        line.setAttribute("x1", start.x);
        line.setAttribute("y1", start.y);
        line.setAttribute("x2", end.x);
        line.setAttribute("y2", end.y);

        // 3. Lógica de Color y Estilo (Recuperada de v7 con soporte v13)
        const isSel = window.AppCore.seleccion.includes(el.id);
        const grosorBase = el.props.diametro ? parseFloat(el.props.diametro) / 10 : 2;
        
        // Color según tipo (Vertical vs Horizontal) - Basado en v7
        const color = isSel ? "#ff0000" : 
                     (el.p1.z !== el.p2.z || el.props.isVertical ? "#00ff00" : "#ffd700");

        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", isSel ? grosorBase + 2 : grosorBase);
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("class", "entidad-tuberia");
        line.style.cursor = "pointer";

        // 4. Eventos de interacción
        line.onclick = (e) => {
            e.stopPropagation();
            window.AppCore.seleccion = [el.id];
            this.dibujarEscena();
            if (window.PropsPanel) window.PropsPanel.abrir(el);
        };

        this.capas.elementos.appendChild(line);
    },

    dibujarEtiqueta: function(el, s, e, color, diamStr) {
        const midX = (s.x + e.x) / 2;
        const midY = (s.y + e.y) / 2;
        const offX = (el.props && el.props.tagOffX) || 0;
        const offY = (el.props && el.props.tagOffY) || 0;

        const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreignObj.setAttribute("x", midX + offX);
        foreignObj.setAttribute("y", midY + offY);
        foreignObj.setAttribute("width", "130");
        foreignObj.setAttribute("height", "50");
        
        const longReal = Math.sqrt(Math.pow(el.dx||0, 2) + Math.pow(el.dy||0, 2) + Math.pow(el.dz||0, 2));
        const L = (el.props.longitudManual || longReal).toFixed(2);

        foreignObj.innerHTML = `
            <div class="tag-label" style="color:#fff; font-family:monospace; font-size:9px; background:rgba(0,0,0,0.8); padding:4px; border-radius:3px; border-left: 3px solid ${color}; pointer-events:none;">
                <b>${el.props.tag || 'Tramo'}</b><br>
                ${diamStr} | ${L}m
            </div>
        `;
        this.capas.elementos.appendChild(foreignObj);
    },

    dibujarEquipo: function(el) {
        const p = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const zoom = window.estado.view.zoom || 1;
        const tileW = window.CONFIG.tileW; 
        
        const size = (el.props.longitudReal || 0.1) * tileW * (el.props.escala || 1) * zoom;
        const rot = (el.props.rotacionAxial || 0); 
        const isSel = window.estado.selectedId === el.id;
        let color = isSel ? '#f1c40f' : (el.props.colorRef || '#00d4ff');

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

    actualizarTransformacion: function() {
        const contenedor = document.getElementById('capa-transformacion');
        const transformIdentidad = `translate(0px, 0px) scale(1)`;

        if (contenedor) contenedor.style.transform = transformIdentidad;
        if (this.capas.grid) this.capas.grid.style.transform = transformIdentidad;
        if (this.capas.elementos) this.capas.elementos.style.transform = transformIdentidad;

        const hudZ = document.getElementById('hud-z');
        const hudScale = document.getElementById('hud-scale');
        
        if (hudZ) hudZ.innerText = window.estado.currentZ.toFixed(3);
        if (hudScale) {
            hudScale.innerText = Math.round((window.estado.view.zoom || 1) * 100) + "%";
        }
    }
};
