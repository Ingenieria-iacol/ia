/**
 * js/io/pdf-export.js
 * Reporte profesional con BOM (Bill of Materials) escalado métricamente.
 */

window.PDFExport = {
    generarReporte: function() {
        console.log("📄 Generando reporte métrico...");
        
        if (!window.jspdf || !window.html2canvas) {
            alert("Error: Librerías de exportación no cargadas.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const mainArea = document.getElementById('main-area');

        html2canvas(mainArea, {
            backgroundColor: "#111",
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // ENCABEZADO PRO
            doc.setFillColor(0, 113, 235);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("REPORTE TÉCNICO DE INGENIERÍA - GAS", 105, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Proyecto: Isométrico Proporcional | Fecha: ${new Date().toLocaleString()}`, 105, 26, { align: 'center' });
            
            // VISTA DEL DISEÑO
            doc.addImage(imgData, 'PNG', 10, 40, 190, 100);
            
            // CÁLCULO DE MATERIALES (SIMETRÍA MÉTRICA)
            const resumen = {};
            
            window.AppCore.elementos.forEach(el => {
                let nombre = "";
                let cantidad = 1;
                let unidad = "und";

                if (el.tipo === 'tuberia') {
                    const diam = el.props.diamNominal || '1/2"';
                    nombre = `TUBERÍA DE GAS - Ø ${diam}`;
                    unidad = "m";
                    
                    // Cálculo de longitud real usando el motor matemático 3D
                    // Se calcula la hipotenusa de dx, dy y dz para obtener metros reales
                    cantidad = Math.sqrt(
                        Math.pow(el.dx || 0, 2) + 
                        Math.pow(el.dy || 0, 2) + 
                        Math.pow(el.dz || 0, 2)
                    );
                } else {
                    // Identificación de accesorios por nombre de catálogo
                    nombre = (el.props.tag || el.props.name || "Accesorio").toUpperCase();
                    const diam = el.props.diamNominal || (el.props.diamIn ? el.props.diamIn : "");
                    if(diam) nombre += ` - Ø ${diam}`;
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

            // TABLA DE MATERIALES
            doc.autoTable({
                startY: 145,
                head: [['Descripción del Material', 'Cantidad', 'Unidad']],
                body: filasBOM,
                headStyles: { fillColor: [0, 113, 235], fontSize: 10 },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 3 }
            });

            // PIE DE PÁGINA
            const totalPages = doc.internal.getNumberOfPages();
            for(let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`CAD Gas v2.10.4 - Sistema Métrico Proporcional - Página ${i} de ${totalPages}`, 105, 285, { align: 'center' });
            }

            doc.save(`Reporte_Ingenieria_${Date.now()}.pdf`);
        });
    }
};

// Vinculación con el botón del Header
document.getElementById('btn-pdf-gen')?.addEventListener('click', () => window.PDFExport.generarReporte());
