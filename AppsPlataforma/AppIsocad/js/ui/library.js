/**
 * js/ui/library.js
 * Gestiona la carga de componentes y herramientas en el panel izquierdo
 */

window.AppLibrary = {
    /**
     * Inicializa la biblioteca cargando todos los grupos del catálogo
     */
    init: function() {
        const container = document.getElementById('library-container');
        if (!container) return;

        container.innerHTML = ''; // Limpiar previo
        
        // Recorremos las categorías del catálogo (mat, comp, eq, etc.)
        // definidas en js/config.js
        Object.keys(window.CATALOGO).forEach(catKey => {
            const grupo = window.CATALOGO[catKey];
            const seccion = this.crearSeccion(catKey, grupo);
            container.appendChild(seccion);
        });
        
        console.log("📚 Biblioteca de componentes lista.");
    },

    /**
     * Crea un bloque colapsable para cada categoría (Tuberías, Válvulas, etc.)
     */
    crearSeccion: function(id, items) {
        const div = document.createElement('div');
        div.className = 'lib-group';
        
        // Título de la categoría
        const title = document.createElement('div');
        title.className = 'lib-group-title';
        title.innerHTML = `${this.obtenerNombreCategoria(id)} <span>▼</span>`;
        title.onclick = () => this.toggleGrupo(div);
        
        const itemsCont = document.createElement('div');
        itemsCont.className = 'lib-items';
        
        // Llenar con los componentes individuales
        items.forEach(item => {
            const itemUI = this.crearItemUI(item);
            itemsCont.appendChild(itemUI);
        });
        
        div.appendChild(title);
        div.appendChild(itemsCont);
        return div;
    },

    /**
     * Crea el botón visual de cada componente (Icono + Nombre)
     */
    crearItemUI: function(item) {
        const div = document.createElement('div');
        div.className = 'tool-item';
        div.id = `item-${item.id}`;
        
        // Insertamos el icono SVG definido en ICONS
        const iconWrap = document.createElement('div');
        iconWrap.className = 'tool-icon';
        iconWrap.innerHTML = item.icon || '▪';
        
        const nameWrap = document.createElement('div');
        nameWrap.className = 'tool-name';
        nameWrap.innerText = item.name;

        div.appendChild(iconWrap);
        div.appendChild(nameWrap);

        // Al hacer clic, activamos esta herramienta en el estado global
        div.onclick = () => {
            this.seleccionarHerramienta(item, div);
        };

        return div;
    },

    seleccionarHerramienta: function(item, element) {
        // Desmarcar todos los items
        document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
        
        // Marcar el actual
        element.classList.add('active');
        
        // Actualizar el estado global del cerebro
        window.estado.tool = item.type === 'tuberia' ? 'tool-pipe' : 'tool-insert';
        window.estado.activeItem = item;
        
        console.log(`Herramienta activa: ${item.name}`);
    },

    toggleGrupo: function(elemento) {
        const items = elemento.querySelector('.lib-items');
        items.style.display = (items.style.display === 'block') ? 'none' : 'block';
    },

    obtenerNombreCategoria: function(id) {
        const nombres = {
            mat: 'Tuberías',
            comp: 'Válvulas',
            eq: 'Equipos',
            inst: 'Instrumentos',
            perif: 'Tanques',
            cons: 'Insumos'
        };
        return nombres[id] || id.toUpperCase();
    }
};
