/**
 * iu/props.js - RESTAURACIÓN QUIRÚRGICA FINAL
 */
window.PropsPanel = {
    abrir: function(el) {
        const card = document.getElementById('prop-card');
        const content = document.getElementById('prop-content');
        if (!card || !content) return;

        card.style.display = 'block';
        let html = `<h3 style="margin:0 0 10px 0; font-size:0.9rem; color:#0071eb; border-bottom:1px solid #333; padding-bottom:5px;">${el.tipo.toUpperCase()}</h3>`;
        
        // --- IDENTIFICADOR (TAG) ---
        html += `
            <div class="prop-row">
                <label>Tag / Identificador</label>
                <input type="text" value="${el.props.tag || ''}" placeholder="Ej: V-101" 
                    onchange="window.PropsPanel.actualizarProp(${el.id}, 'tag', this.value)">
            </div>
        `;

        // --- ELEVACIÓN Z (Crítica para el motor de gas) ---
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
            // --- PROPIEDADES DE TRANSFORMACIÓN ---
            const rot = el.props.rotacionAxial || 0;
            html += `
                <div class="prop-row">
                    <label>Orientación Axial</label>
                    <button class="btn" style="width:100%; height:32px; cursor:pointer;" onclick="window.PropsPanel.toggleRotacion(${el.id})">
                        ${rot === 0 ? '⬌ Horizontal' : '⬈ Vertical'}
                    </button>
                </div>
                <div class="prop-row">
                    <label>Escala (Tamaño): ${(el.props.escala || 1).toFixed(1)}x</label>
                    <input type="range" min="0.5" max="3" step="0.1" value="${el.props.escala || 1}" 
                        style="width:100%" oninput="window.PropsPanel.actualizarProp(${el.id}, 'escala', parseFloat(this.value))">
                </div>
                <div class="prop-row">
                    <label>Color Personalizado</label>
                    <input type="color" value="${el.props.colorRef || '#ffffff'}" 
                        onchange="window.PropsPanel.actualizarProp(${el.id}, 'colorRef', this.value)">
                </div>
            `;
        }

        // Botón eliminar vinculado a AppCore
        html += `
            <button class="btn" style="width:100%; margin-top:15px; background:#922; color:white; border:none;" 
                onclick="window.AppCore.borrarSeleccion()">Eliminar</button>
        `;
        content.innerHTML = html;
    },

    toggleRotacion: function(id) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        if (el) {
            el.props.rotacionAxial = (el.props.rotacionAxial === 90) ? 0 : 90;
            window.AppCore.guardarEstado();
            window.CADRenderer.dibujarEscena();
            this.abrir(el);
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
            el.props[prop] = valor;
            window.AppCore.guardarEstado();
            window.CADRenderer.dibujarEscena();
            if (prop === 'escala') this.abrir(el);
        }
    },

    cerrar: function() {
        const card = document.getElementById('prop-card');
        if(card) card.style.display = 'none';
    }
};
