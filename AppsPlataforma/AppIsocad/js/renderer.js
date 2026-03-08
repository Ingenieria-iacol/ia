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
        
        // Sincronización de la cámara (Ahora resetea el contenedor a identidad)
        this.actualizarTransformacion();
    },

    dibujarGrid: function() {
        const view = window.estado.view;
        const zoom = view.zoom || 1; 
        
        // Culling y radio adaptativo para performance
        const radioBase = 20; 
        const radioAdaptativo = Math.ceil(radioBase / zoom); 
        const radio = Math.min(radioAdaptativo, 100);

        let dMetros = "";
        
        for (let i = -radio; i <= radio; i++) {
            // CADMath.isoToScreen integra internamente el zoom y pan del estado
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
        const p1 = window.CADMath.isoToScreen(el.x1, el.y1, el.z1);
        const p2 = window.CADMath.isoToScreen(el.x2, el.y2, el.z2);

        const linea = document.createElementNS("http://www.w3.org/2000/svg", "line");
        linea.setAttribute('x1', p1.x);
        linea.setAttribute('y1', p1.y);
        linea.setAttribute('x2', p2.x);
        linea.setAttribute('y2', p2.y);

        // CORRECCIÓN: Priorizar color de instancia, luego de librería, luego por defecto
        const colorFinal = el.props.color || el.color || (window.CONFIG.colores ? window.CONFIG.colores.tuberia : '#7f8c8d');
        
        linea.setAttribute('stroke', colorFinal);
        linea.setAttribute('stroke-width', 3 * window.estado.view.zoom); // Grosor escalado
        linea.setAttribute('stroke-linecap', 'round');
        
        // Si está seleccionado, añadir brillo o clase
        if (window.estado.selectedId === el.id) {
            linea.setAttribute('stroke-width', 5 * window.estado.view.zoom);
            linea.setAttribute('filter', 'url(#glow)');
        }

        this.capas.elementos.appendChild(linea);
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
        const zoom = window.estado.view.zoom || 1;
        const tileW = window.CONFIG.tileW; 
        
        // El tamaño del icono escala proporcionalmente al zoom global
        const size = (el.props.longitudReal || 0.1) * tileW * (el.props.escala || 1) * zoom;
        
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

    actualizarTransformacion: function() {
        const contenedor = document.getElementById('capa-transformacion');
        if (contenedor) {
            contenedor.style.transform = `translate(0px, 0px) scale(1)`;
        }

        const transformIdentidad = `translate(0px, 0px) scale(1)`;
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
