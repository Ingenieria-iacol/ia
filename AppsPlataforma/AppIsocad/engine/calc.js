/**
 * iu/props.js - Versión Profesional Consolidada
 */
window.PropsPanel = {
    abrir: function(el) {
        const card = document.getElementById('prop-card');
        const content = document.getElementById('prop-content');
        if (!card || !content) return;

        card.style.display = 'block';
        let html = `<h3 style="margin:0 0 10px 0; font-size:0.9rem; color:#0071eb; border-bottom:1px solid #333; padding-bottom:5px;">${el.tipo.toUpperCase()}</h3>`;
        
        // --- PROPIEDAD: TAG (Identificador único para planos) ---
        html += `
            <div class="prop-row">
                <label>Tag / Identificador</label>
                <input type="text" value="${el.props.tag || ''}" placeholder="Ej: V-101" 
                    onchange="window.PropsPanel.actualizarProp(${el.id}, 'tag', this.value)">
            </div>
        `;

        // --- PROPIEDAD: ELEVACIÓN (Original preservada) ---
        html += `
            <div class="prop-row">
                <label>Elevación Z (m)</label>
                <input type="number" step="0.1" value="${(el.z || 0).toFixed(2)}" 
                    onchange="window.PropsPanel.actualizar(${el.id}, 'z', this.value)">
            </div>
        `;

        if (el.tipo === 'tuberia') {
            // Lógica de Ingeniería para tuberías
            const caudal = el.props.caudal || 2.5;
            const presion = el.props.presionEntrada || 19;
            const calc = window.GasEngine.calculateFlow({
                diamNominal: el.props.diamNominal || '1/2"',
                longitud: el.props.longitudManual || 1,
                caudal: caudal,
                tipoGas: 'NATURAL',
                presionEntrada: presion
            });

            html += `
                <div class="prop-row">
                    <label>Diámetro Comercial</label>
                    <select onchange="window.PropsPanel.actualizarProp(${el.id}, 'diamNominal', this.value)">
                        ${Object.values(window.DIAMETROS_DISPONIBLES).flat().map(d => 
                            `<option value='${d}' ${el.props.diamNominal === d ? 'selected' : ''}>${d}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="prop-row">
                    <label>Caudal (m³/h)</label>
                    <input type="number" step="0.1" value="${caudal}" 
                        onchange="window.PropsPanel.actualizarProp(${el.id}, 'caudal', parseFloat(this.value))">
                </div>
                
                <div style="background:#000; padding:10px; border-radius:4px; margin-top:10px; border-left:3px solid ${calc.estado === 'OK' ? '#0f0' : '#f00'};">
                    <div style="font-size:0.65rem; color:#888; text-transform:uppercase;">Cálculo de Mueller:</div>
                    <div style="font-size:0.85rem; font-weight:bold; color:#fff;">ΔP: ${calc.caidaPresionStr} (${calc.porcentajeCaida})</div>
                    <div style="font-size:0.75rem; color:${calc.estado === 'OK' ? '#aaa' : '#ff4444'};">Vel: ${calc.velocidad} - ${calc.estado}</div>
                </div>
            `;
        } else {
            // Propiedades para Equipos/Válvulas
            const rot = el.props.rotacionAxial || 0;
            html += `
                <div class="prop-row">
                    <label>Orientación</label>
                    <button class="btn" style="width:100%; height:30px;" onclick="window.PropsPanel.toggleRotacion(${el.id})">
                        ${rot === 0 ? '⬌ Horizontal' : '⬈ Vertical'}
                    </button>
                </div>
                <div class="prop-row">
                    <label>Tamaño (Escala): ${(el.props.escala || 1).toFixed(1)}x</label>
                    <input type="range" min="0.5" max="3" step="0.1" value="${el.props.escala || 1}" 
                        oninput="window.PropsPanel.actualizarProp(${el.id}, 'escala', parseFloat(this.value))">
                </div>
                <div class="prop-row">
                    <label>Color Personalizado</label>
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
            if (prop === 'escala' || prop === 'caudal') this.abrir(el);
        }
    },

    cerrar: function() {
        const card = document.getElementById('prop-card');
        if(card) card.style.display = 'none';
    }
};
