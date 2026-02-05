/**
 * js/ui/props.js
 * Gestiona el panel de edición de atributos de los elementos
 */

window.PropsPanel = {
    /**
     * Muestra las propiedades del elemento seleccionado
     * @param {object} el - Elemento del AppCore
     */
    abrir: function(el) {
        const card = document.getElementById('prop-card');
        const content = document.getElementById('prop-content');
        if (!card || !content) return;

        card.style.display = 'block';
        content.innerHTML = ''; // Limpiar panel

        // 1. Cabecera dinámica
        this.renderHeader(el, content);

        // 2. Campos comunes (Z, Capa, Color)
        this.renderCamposBase(el, content);

        // 3. Campos específicos según tipo
        if (el.tipo === 'tuberia') {
            this.renderPropiedadesTuberia(el, content);
        } else if (el.props.tipo === 'tanque_glp') {
            this.renderPropiedadesTanque(el, content);
        }

        // 4. Botón de eliminación
        this.renderBotonEliminar(el, content);
    },

    renderHeader: function(el, container) {
        const title = document.createElement('h3');
        title.style.margin = "0 0 15px 0";
        title.innerText = el.name || el.tipo.toUpperCase();
        container.appendChild(title);
    },

    renderCamposBase: function(el, container) {
        const html = `
            <div class="prop-row">
                <label>Elevación Z (m)</label>
                <input type="number" step="0.1" value="${el.z}" 
                    onchange="window.PropsPanel.actualizar(${el.id}, 'z', this.value)">
            </div>
            <div class="prop-row">
                <label>Color</label>
                <input type="color" value="${el.props.customColor || '#ffd700'}" 
                    onchange="window.PropsPanel.actualizarProp(${el.id}, 'customColor', this.value)">
            </div>
        `;
        container.innerHTML += html;
    },

    renderPropiedadesTuberia: function(el, container) {
        // Obtenemos los diámetros según el material desde el config.js
        const material = el.props.material || 'acero_sch40';
        const diametros = window.DIAMETROS_DISPONIBLES[material] || [];

        let opciones = diametros.map(d => `<option value='${d}' ${el.props.diamNominal === d ? 'selected' : ''}>${d}</option>`).join('');

        const html = `
            <div style="margin-top:15px; border-top:1px solid #444; padding-top:10px;">
                <label style="font-size:0.8rem; color:var(--accent)">DATOS TÉCNICOS</label>
                <div class="prop-row">
                    <label>Diámetro Nominal</label>
                    <select onchange="window.PropsPanel.actualizarProp(${el.id}, 'diamNominal', this.value)">
                        ${opciones}
                    </select>
                </div>
                <button class="btn primary" style="width:100%; margin-top:10px;" 
                    onclick="window.PropsPanel.calcularHidraulica(${el.id})">
                    Iterar Cálculo ⚡
                </button>
                <div id="res-calculo" style="margin-top:10px; font-size:0.8rem;"></div>
            </div>
        `;
        container.innerHTML += html;
    },

    /**
     * Conecta con el motor de cálculo (js/engine/calc.js)
     */
    calcularHidraulica: function(id) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        if (!el) return;

        // Pedimos datos al motor de cálculo
        const resultado = window.GasEngine.calculateFlow({
            diamNominal: el.props.diamNominal,
            longitud: Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2),
            caudal: 2.5, // Esto podría venir de un input
            tipoGas: 'natural',
            presionEntrada: 23
        });

        document.getElementById('res-calculo').innerHTML = `
            <div style="color:${resultado.estado === 'OK' ? '#0f0' : '#f44'}">
                ΔP: ${resultado.caidaPresionStr}<br>
                Vel: ${resultado.velocidad}<br>
                Estado: ${resultado.estado}
            </div>
        `;
    },

    /**
     * Actualiza valores en el Core y refresca la vista
     */
    actualizar: function(id, campo, valor) {
        const el = window.AppCore.elementos.find(x => x.id === id);
        if (el) {
            el[campo] = window.Utils.parseInput(valor);
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

    renderBotonEliminar: function(el, container) {
        const btn = document.createElement('button');
        btn.className = "btn danger";
        btn.style.width = "100%";
        btn.style.marginTop = "20px";
        btn.innerText = "Eliminar Elemento";
        btn.onclick = () => window.AppCore.borrarSeleccion();
        container.appendChild(btn);
    },

    cerrar: function() {
        document.getElementById('prop-card').style.display = 'none';
    }
};
