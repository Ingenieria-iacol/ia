/**
 * iu/props.js
 * Gestiona el panel de edición de atributos
 */

window.PropsPanel = {
    abrir: function(el) {
        const card = document.getElementById('prop-card');
        const content = document.getElementById('prop-content');
        if (!card || !content) return;

        card.style.display = 'block';
        content.innerHTML = `
            <h3 style="margin:0 0 10px 0; font-size:1rem; color:#fff;">${el.tipo.toUpperCase()}</h3>
            <div class="prop-row">
                <label>Elevación Z (m)</label>
                <input type="number" step="0.1" value="${el.z.toFixed(2)}" 
                    onchange="window.PropsPanel.actualizar(${el.id}, 'z', this.value)">
            </div>
            <div class="prop-row">
                <label>Color</label>
                <input type="color" value="${el.props.customColor || '#ffd700'}" 
                    onchange="window.PropsPanel.actualizarProp(${el.id}, 'customColor', this.value)">
            </div>
        `;

        if (el.tipo === 'tuberia') {
            this.renderExtraTuberia(el, content);
        }
        
        content.innerHTML += `
            <button class="btn" style="width:100%; margin-top:15px; background:#922;" 
                onclick="window.AppCore.borrarSeleccion()">Eliminar</button>
        `;
    },

    renderExtraTuberia: function(el, container) {
        const material = el.props.material || 'acero_sch40';
        const diams = window.DIAMETROS_DISPONIBLES[material] || [];
        let opciones = diams.map(d => `<option value='${d}' ${el.props.diamNominal === d ? 'selected' : ''}>${d}</option>`).join('');

        container.innerHTML += `
            <div style="margin-top:10px; border-top:1px solid #444; padding-top:10px;">
                <div class="prop-row">
                    <label>Diámetro</label>
                    <select onchange="window.PropsPanel.actualizarProp(${el.id}, 'diamNominal', this.value)">${opciones}</select>
                </div>
                <button class="btn primary" style="width:100%;" onclick="window.PropsPanel.calc(${el.id})">Calcular Gas ⚡</button>
                <div id="res-calc" style="margin-top:10px; font-size:0.75rem;"></div>
            </div>
        `;
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
        }
    },

    calc: function(id) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        const L = Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2);
        const res = window.GasEngine.calculateFlow({
            diamNominal: el.props.diamNominal,
            longitud: L, caudal: 2.5, tipoGas: 'natural', presionEntrada: 23
        });
        document.getElementById('res-calc').innerHTML = `ΔP: ${res.caidaPresionStr} | Vel: ${res.velocidad}`;
    },

    cerrar: function() {
        document.getElementById('prop-card').style.display = 'none';
    }
};
