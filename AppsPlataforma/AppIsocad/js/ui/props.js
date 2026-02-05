// js/ui/props.js
window.PropsPanel = {
    abrir: function(elemento) {
        const card = document.getElementById('prop-card');
        card.classList.add('active');
        this.renderizarCabecera(elemento);
        
        if (elemento.tipo === 'tuberia') {
            this.formTuberia(elemento);
        } else if (elemento.props.tipo === 'tanque_glp') {
            this.formTanque(elemento);
        }
        // ... demás tipos
    },

    renderizarCabecera: function(el) {
        document.getElementById('pc-title-text').innerText = el.tipo.toUpperCase();
        // Lógica de iconos del hero...
    },

    formTuberia: function(el) {
        const cont = document.getElementById('prop-datos-tecnicos-container');
        cont.innerHTML = `
            <div class="prop-row">
                <label>Diámetro</label>
                <select onchange="window.Actions.cambiarDiametro(this.value)">
                    ${this.generarOpcionesDiametro(el.props.material)}
                </select>
            </div>
        `;
    }
};
