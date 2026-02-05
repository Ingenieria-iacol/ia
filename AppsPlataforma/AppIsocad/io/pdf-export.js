/**
 * js/io/pdf-export.js
 * Generación de reportes profesionales en PDF
 */

window.PDFExport = {
    /**
     * Genera el PDF usando jsPDF y html2canvas
     */
    generarReporte: function() {
        console.log("📄 Generando PDF...");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Capturar el área de dibujo
        html2canvas(document.getElementById('main-area')).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // Encabezado
            doc.setFontSize(18);
            doc.text("REPORTE TÉCNICO - ISOMÉTRICO DE GAS", 105, 20, { align: 'center' });
            
            // Imagen del CAD
            doc.addImage(imgData, 'PNG', 10, 30, 190, 100);
            
            // Tabla de Materiales
            const filas = window.AppCore.elementos.map(el => [
                el.tipo.toUpperCase(),
                el.props.material || "N/A",
                el.props.diamNominal || "N/A",
                el.tipo === 'tuberia' ? (Math.sqrt(el.dx**2 + el.dy**2 + el.dz**2)).toFixed(2) + "m" : "1 und"
            ]);

            doc.autoTable({
                startY: 140,
                head: [['Tipo', 'Material', 'Diámetro', 'Cantidad/Longitud']],
                body: filas,
            });

            doc.save("Reporte_Ingenieria_Gas.pdf");
        });
    }
};

// Conectar con el botón del index.html
document.getElementById('btn-pdf-gen')?.addEventListener('click', () => window.PDFExport.generarReporte());
