/**
 * iu/library.js
 * Gestiona la carga de componentes y herramientas en el panel izquierdo
 */

window.AppLibrary = {
    init: function() {
        const container = document.getElementById('library-container');
        if (!container) return;

        container.innerHTML = ''; 
        
        Object.keys(window.CATALOGO).forEach(catKey => {
            const grupo = window.CATALOGO[catKey];
            const seccion = this.crearSeccion(catKey, grupo);
            container.appendChild(seccion);
        });
        
        console.log("📚 Biblioteca de componentes lista.");
    },

    crearSeccion: function(id, items) {
        const div = document.createElement('div');
        div.className = 'lib-group';
        
        const title = document.createElement('div');
        title.className = 'lib-group-title';
        title.innerHTML = `${this.obtenerNombreCategoria(id)} <span>▼</span>`;
        title.onclick = () => this.toggleGrupo(div);
        
        const itemsCont = document.createElement('div');
        itemsCont.className = 'lib-items';
        itemsCont.style.display = (id === 'mat') ? 'block' : 'none'; // Solo tuberías abiertas al inicio
        
        items.forEach(item => {
            const itemUI = this.crearItemUI(item);
            itemsCont.appendChild(itemUI);
        });
        
        div.appendChild(title);
        div.appendChild(itemsCont);
        return div;
    },

    crearItemUI: function(item) {
        const div = document.createElement('div');
        div.className = 'tool-item';
        div.id = `item-${item.id}`;
        
        const iconWrap = document.createElement('div');
        iconWrap.className = 'tool-icon';
        iconWrap.innerHTML = item.icon || '▪';
        
        const nameWrap = document.createElement('div');
        nameWrap.className = 'tool-name';
        nameWrap.innerText = item.name;

        div.appendChild(iconWrap);
        div.appendChild(nameWrap);

        div.onclick = () => {
            document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            
            // Configurar herramienta según el tipo de catálogo
            window.estado.tool = (item.type === 'tuberia') ? 'tool-pipe' : 'tool-insert';
            window.estado.activeItem = item;
            
            // Si seleccionamos algo que no es seleccionar, quitamos el botón de selección del header
            document.getElementById('btn-tool-select').classList.remove('active');
        };

        return div;
    },

    toggleGrupo: function(elemento) {
        const items = elemento.querySelector('.lib-items');
        items.style.display = (items.style.display === 'block') ? 'none' : 'block';
    },

    obtenerNombreCategoria: function(id) {
        const nombres = {
            mat: 'Tuberías', comp: 'Válvulas', eq: 'Equipos',
            inst: 'Instrumentos', perif: 'Tanques', cons: 'Insumos'
        };
        return nombres[id] || id.toUpperCase();
    }
};
