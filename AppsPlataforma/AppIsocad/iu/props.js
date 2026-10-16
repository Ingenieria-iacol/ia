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
            // Datos de ingeniería del tramo (alimentan la memoria de cálculo del Reporte PDF)
            const material = el.props.material || 'acero_sch40';
            const lista = (window.DIAMETROS_DISPONIBLES && window.DIAMETROS_DISPONIBLES[material]) || ['1/2"', '3/4"', '1"'];
            const diam = el.props.diamNominal || el.props.diametroNominal || lista[0];
            const caudal = el.props.caudal || 2.5;
            const presion = el.props.presionEntrada || 19;
            const longReal = Math.sqrt(Math.pow(el.dx || 0, 2) + Math.pow(el.dy || 0, 2) + Math.pow(el.dz || 0, 2));
            const calc = window.GasEngine ? window.GasEngine.calculateFlow({ diamNominal: diam, longitud: el.props.longitudManual || longReal, caudal, tipoGas: 'NATURAL', presionEntrada: presion, material }) : null;
            const mats = Object.keys(window.DIAMETROS_DISPONIBLES || {});
            html += `
                <div class="prop-row">
                    <label>Material</label>
                    <select onchange="window.PropsPanel.actualizarProp(${el.id}, 'material', this.value)">
                        ${mats.map(m => `<option value="${m}" ${m === material ? 'selected' : ''}>${m.replace(/_/g, ' ')}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-row">
                    <label>Diámetro</label>
                    <select onchange="window.PropsPanel.actualizarProp(${el.id}, 'diamNominal', this.value)">
                        ${lista.map(d => `<option value='${d}' ${d === diam ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-row">
                    <label>Caudal (m³/h)</label>
                    <input type="number" step="0.1" min="0" value="${caudal}" onchange="window.PropsPanel.actualizarProp(${el.id}, 'caudal', parseFloat(this.value) || 0)">
                </div>
                <div class="prop-row">
                    <label>Presión de entrada (mbar)</label>
                    <input type="number" step="1" min="0" value="${presion}" onchange="window.PropsPanel.actualizarProp(${el.id}, 'presionEntrada', parseFloat(this.value) || 0)">
                </div>
                ${calc ? `<div style="background:#000; padding:10px; border-radius:4px; margin-top:6px; border-left:3px solid ${calc.estado === 'OK' ? '#3fbf7f' : '#ef5b5b'};">
                    <div style="font-size:0.65rem; color:#888; text-transform:uppercase;">Cálculo del tramo (L = ${(el.props.longitudManual || longReal).toFixed(2)} m · Ø int ${calc.diametroInterno.toFixed(2)} mm)</div>
                    <div style="font-size:0.85rem; font-weight:bold; color:#fff;">ΔP: ${calc.caidaPresionStr} (${calc.porcentajeCaida})</div>
                    <div style="font-size:0.75rem; color:${calc.estado === 'OK' ? '#aaa' : '#ff6b6b'};">V: ${calc.velocidad} · ${calc.estado}</div>
                </div>` : ''}
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
            if (['escala', 'material', 'diamNominal', 'caudal', 'presionEntrada'].includes(prop)) {
                // al cambiar de material, el diámetro debe existir en la nueva lista
                if (prop === 'material' && window.DIAMETROS_DISPONIBLES && window.DIAMETROS_DISPONIBLES[valor] && !window.DIAMETROS_DISPONIBLES[valor].includes(el.props.diamNominal)) el.props.diamNominal = window.DIAMETROS_DISPONIBLES[valor][0];
                this.abrir(el);
            }
        }
    },

    cerrar: function() {
        const card = document.getElementById('prop-card');
        if(card) card.style.display = 'none';
    }
};
