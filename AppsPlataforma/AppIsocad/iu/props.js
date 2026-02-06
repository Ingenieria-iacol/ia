/**
 * iu/props.js - Versión Mejorada
 */
window.PropsPanel = {
    abrir: function(el) {
        const card = document.getElementById('prop-card');
        const content = document.getElementById('prop-content');
        if (!card || !content) return;

        card.style.display = 'block';
        let html = `<h3 style="margin:0 0 10px 0; font-size:0.9rem; color:#0071eb; border-bottom:1px solid #333; padding-bottom:5px;">${el.tipo.toUpperCase()}</h3>`;
        
        // --- PROPIEDAD: TAG ---
        html += `
            <div class="prop-row">
                <label>Identificador (Tag)</label>
                <input type="text" value="${el.props.tag || ''}" placeholder="Ej: V-01" 
                    onchange="window.PropsPanel.actualizarProp(${el.id}, 'tag', this.value)">
            </div>
        `;

        // --- PROPIEDAD: ELEVACIÓN (Existente) ---
        html += `
            <div class="prop-row">
                <label>Elevación Z (m)</label>
                <input type="number" step="0.1" value="${(el.z || 0).toFixed(2)}" 
                    onchange="window.PropsPanel.actualizar(${el.id}, 'z', this.value)">
            </div>
        `;

        if (el.tipo === 'tuberia') {
            html += `
                <div class="prop-row">
                    <label>Diámetro</label>
                    <select onchange="window.PropsPanel.actualizarProp(${el.id}, 'diamNominal', this.value)">
                        <option value='1/2"' ${el.props.diamNominal === '1/2"' ? 'selected' : ''}>1/2"</option>
                        <option value='3/4"' ${el.props.diamNominal === '3/4"' ? 'selected' : ''}>3/4"</option>
                        <option value='1"' ${el.props.diamNominal === '1"' ? 'selected' : ''}>1"</option>
                    </select>
                </div>
            `;
        } else {
            // --- PROPIEDADES PARA EQUIPOS/VÁLVULAS ---
            
            // Rotación 0/90
            const rot = el.props.rotacionAxial || 0;
            html += `
                <div class="prop-row">
                    <label>Orientación</label>
                    <button class="btn" style="width:100%" onclick="window.PropsPanel.toggleRotacion(${el.id})">
                        ${rot === 0 ? '⬌ Horizontal' : '⬈ Vertical'}
                    </button>
                </div>
            `;

            // Escala Proporcional
            html += `
                <div class="prop-row">
                    <label>Tamaño (Escala)</label>
                    <input type="range" min="0.5" max="3" step="0.1" value="${el.props.escala || 1}" 
                        oninput="window.PropsPanel.actualizarProp(${el.id}, 'escala', this.value)">
                </div>
            `;

            // Color del objeto
            html += `
                <div class="prop-row">
                    <label>Color de Representación</label>
                    <input type="color" value="${el.props.colorRef || '#ffffff'}" 
                        onchange="window.PropsPanel.actualizarProp(${el.id}, 'colorRef', this.value)">
                </div>
            `;
        }

        html += `
            <button class="btn" style="width:100%; margin-top:15px; background:#922; color:white; border:none;" 
                onclick="window.AppCore.borrarSeleccion()">Eliminar Objeto</button>
        `;
        content.innerHTML = html;
    },

    toggleRotacion: function(id) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        if (el) {
            const actual = el.props.rotacionAxial || 0;
            el.props.rotacionAxial = (actual === 0) ? 90 : 0;
            window.AppCore.guardarEstado();
            window.CADRenderer.dibujarEscena();
            this.abrir(el); // Refrescar panel
        }
    },

    actualizar: function(id, campo, valor) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        if (el) {
            el[campo] = parseFloat(valor);
            window.AppCore.guardarEstado();
            window.CADRenderer.dibujarEscena();
        }
    },

    actualizarProp: function(id, prop, valor) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        if (el) {
            // Convertir a número si es escala
            el.props[prop] = (prop === 'escala') ? parseFloat(valor) : valor;
            window.AppCore.guardarEstado();
            window.CADRenderer.dibujarEscena();
        }
    },

    cerrar: function() {
        const card = document.getElementById('prop-card');
        if(card) card.style.display = 'none';
    }
};
