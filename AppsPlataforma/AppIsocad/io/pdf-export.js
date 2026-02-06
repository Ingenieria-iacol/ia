/**
 * js/io/pdf-export.js
 * Generación de reportes profesionales con Lista de Materiales (BOM) y captura de diseño.
 */

window.PDFExport = {
    /**
     * Genera el PDF usando jsPDF y html2canvas.
     */
    generarReporte: function() {
        console.log("📄 Iniciando generación de PDF profesional...");
        
        if (!window.jspdf || !window.html2canvas) {
            console.error("Librerías jsPDF o html2canvas no encontradas.");
            alert("Error: Las librerías de exportación no están cargadas.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const mainArea = document.getElementById('main-area');

        if (!mainArea) {
            alert("Error: No se pudo localizar el área de dibujo.");
            return;
        }

        html2canvas(mainArea, {
            backgroundColor: "#111",
            scale: 2,
            useCORS: true,
            logging: false
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // --- ENCABEZADO ---
            doc.setFillColor(0, 113, 235);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("REPORTE TÉCNICO - ISOMÉTRICO DE GAS", 105, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 105, 26, { align: 'center' });
            
            // --- IMAGEN DEL CAD ---
            doc.addImage(imgData, 'PNG', 10, 40, 190, 100);
            
            // --- CÁLCULO DE LISTA DE MATERIALES (BOM) ---
            const resumen = {};
            
            window.AppCore.elementos.forEach(el => {
                let nombre = "";
                let cantidad = 1;
                let unidad = "und";

                if (el.tipo === 'tuberia') {
                    const diam = el.props.diamNominal || '1/2"';
                    nombre = `TUBERÍA ${diam}`;
                    unidad = "m";
                    // Cálculo de longitud real 3D
                    cantidad = Math.sqrt(
                        Math.pow(el.dx || 0, 2) + 
                        Math.pow(el.dy || 0, 2) + 
                        Math.pow(el.dz || 0, 2)
                    );
                } else {
                    // --- LÓGICA PARA ACCESORIOS (Codos, Tes, etc.) ---
                    // Se busca identificar por subtipo, tag o tipo genérico
                    const tipoAccesorio = (el.props.subtipo || el.tipo).toLowerCase();
                    const diam = el.props.diamNominal || '1/2"';

                    switch(tipoAccesorio) {
                        case 'codo':
                            nombre = `CODO ${el.props.angulo || '90'}° ${diam}`;
                            break;
                        case 'te':
                        case 'tee':
                            nombre = `TÉ GALVANIZADA ${diam}`;
                            break;
                        case 'reduccion':
                            nombre = `REDUCCIÓN ${diam} x ${el.props.diamReducido || '3/8"'}`;
                            break;
                        case 'union':
                            nombre = `UNIÓN SIMPLE ${diam}`;
                            break;
                        case 'valvula':
                            nombre = `VÁLVULA DE BOLA ${diam}`;
                            break;
                        default:
                            nombre = (el.props.tag || el.props.name || el.tipo).toUpperCase();
                    }
                }

                if (!resumen[nombre]) {
                    resumen[nombre] = { cant: 0, uni: unidad };
                }
                resumen[nombre].cant += cantidad;
            });

            const filasBOM = Object.keys(resumen).map(key => [
                key,
                resumen[key].cant.toFixed(2),
                resumen[key].uni
            ]);

            // --- TABLA DE INGENIERÍA ---
            doc.autoTable({
                startY: 145,
                head: [['Descripción del Material', 'Cantidad', 'Unidad']],
                body: filasBOM,
                headStyles: { fillColor: [0, 113, 235] },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                theme: 'grid',
                styles: { fontSize: 9 }
            });

            // Pie de página
            const totalPages = doc.internal.getNumberOfPages();
            for(let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`CAD Gas v2.6 - Página ${i} de ${totalPages}`, 105, 285, { align: 'center' });
            }

            doc.save(`Reporte_Gas_${Date.now()}.pdf`);
            console.log("✅ Reporte PDF generado exitosamente.");
        }).catch(err => {
            console.error("Error capturando el área de dibujo:", err);
            alert("Hubo un error al procesar la imagen del diseño.");
        });
    }
};

document.getElementById('btn-pdf-gen')?.addEventListener('click', () => window.PDFExport.generarReporte());
