/**
 * js/io/pdf-export.js - Versión de Ingeniería Avanzada
 * Detecta automáticamente Codos, Tes y Reducciones por análisis de nodos.
 */

window.PDFExport = {
    generarReporte: function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const mainArea = document.getElementById('main-area');

        html2canvas(mainArea, { backgroundColor: "#111", scale: 2 }).then(canvas => {
            // --- Encabezado y Captura ---
            doc.setFillColor(31, 31, 31);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("REPORTE TÉCNICO Y LISTA DE MATERIALES", 105, 15, { align: 'center' });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 40, 190, 100);

            // --- LÓGICA DE ANÁLISIS TOPOLÓGICO (BOM) ---
            const inventario = {};
            const nodos = {}; // Mapa para rastrear conexiones

            // 1. Registrar tuberías y mapear sus extremos (nodos)
            window.AppCore.elementos.forEach(el => {
                if (el.tipo === 'tuberia') {
                    // Contar longitud de tubería
                    const diam = el.props.diamNominal || '1/2"';
                    const nombreTub = `TUBERÍA ${diam}`;
                    const L = Math.sqrt(Math.pow(el.dx, 2) + Math.pow(el.dy, 2) + Math.pow(el.dz, 2));
                    
                    if (!inventario[nombreTub]) inventario[nombreTub] = { cant: 0, uni: 'm' };
                    inventario[nombreTub].cant += L;

                    // Registrar nodos (Inicio y Fin) para detectar accesorios
                    const p1 = `${el.x},${el.y},${el.z}`;
                    const p2 = `${el.x + el.dx},${el.y + el.dy},${el.z + el.dz}`;
                    
                    [p1, p2].forEach(p => {
                        if (!nodos[p]) nodos[p] = [];
                        nodos[p].push(el);
                    });
                } else {
                    // Equipos y Válvulas directos
                    const nombre = (el.props.tag || el.props.name || el.tipo).toUpperCase();
                    if (!inventario[nombre]) inventario[nombre] = { cant: 0, uni: 'und' };
                    inventario[nombre].cant += 1;
                }
            });

            // 2. Analizar nodos para identificar Codos, Tes y Reducciones
            Object.keys(nodos).forEach(coord => {
                const conectadas = nodos[coord];
                
                if (conectadas.length === 2) {
                    const t1 = conectadas[0];
                    const t2 = conectadas[1];

                    // DETECTAR REDUCCIÓN: Si los diámetros son distintos
                    if (t1.props.diamNominal !== t2.props.diamNominal) {
                        const nombreRed = `REDUCCIÓN ${t1.props.diamNominal} A ${t2.props.diamNominal}`;
                        if (!inventario[nombreRed]) inventario[nombreRed] = { cant: 0, uni: 'und' };
                        inventario[nombreRed].cant += 1;
                    }

                    // DETECTAR CODO: Si cambian de dirección (vectores no paralelos)
                    // Normalizamos vectores para comparar dirección
                    const v1 = { x: t1.dx, y: t1.dy, z: t1.dz };
                    const v2 = { x: t2.dx, y: t2.dy, z: t2.dz };
                    const dotProduct = Math.abs(v1.x*v2.x + v1.y*v2.y + v1.z*v2.z);
                    const mag1 = Math.sqrt(v1.x**2 + v1.y**2 + v1.z**2);
                    const mag2 = Math.sqrt(v2.x**2 + v2.y**2 + v2.z**2);
                    
                    // Si el producto punto no es igual al producto de magnitudes, hay ángulo
                    if (Math.abs(dotProduct - (mag1 * mag2)) > 0.01) {
                        const nombreCodo = `CODO ${t1.props.diamNominal}`;
                        if (!inventario[nombreCodo]) inventario[nombreCodo] = { cant: 0, uni: 'und' };
                        inventario[nombreCodo].cant += 1;
                    }
                } 
                else if (conectadas.length === 3) {
                    // DETECTAR TE: Tres tuberías convergen en un punto
                    const diamBase = conectadas[0].props.diamNominal;
                    const nombreTe = `TE DE DERIVACIÓN ${diamBase}`;
                    if (!inventario[nombreTe]) inventario[nombreTe] = { cant: 0, uni: 'und' };
                    inventario[nombreTe].cant += 1;
                }
            });

            // 3. Crear Filas para la Tabla
            const filasBOM = Object.keys(inventario).map(key => [
                key, 
                inventario[key].cant.toFixed(2), 
                inventario[key].uni
            ]);

            doc.autoTable({
                startY: 145,
                head: [['Material / Accesorio', 'Cantidad', 'Unidad']],
                body: filasBOM,
                headStyles: { fillColor: [0, 113, 235] },
                theme: 'grid'
            });

            doc.save(`Proyecto_Gas_BOM_${Date.now()}.pdf`);
        });
    }
};
