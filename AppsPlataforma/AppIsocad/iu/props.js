/**
 * iu/props.js
 */
window.PropsPanel = {
    abrir: function(el) {
        const card = document.getElementById('prop-card');
        const content = document.getElementById('prop-content');
        if (!card || !content) return;

        card.style.display = 'block';
        let html = `<h3 style="margin:0; font-size:0.9rem; color:#0071eb;">${el.tipo.toUpperCase()}</h3>`;
        
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
        }

        html += `
            <button class="btn" style="width:100%; margin-top:15px; background:#922; color:white; border:none;" 
                onclick="window.AppCore.borrarSeleccion()">Eliminar</button>
        `;
        content.innerHTML = html;
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

    cerrar: function() {
        const card = document.getElementById('prop-card');
        if(card) card.style.display = 'none';
    }
};
