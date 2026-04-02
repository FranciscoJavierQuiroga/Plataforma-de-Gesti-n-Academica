from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from io import BytesIO
from datetime import datetime

class PDFGenerator:
    """Generador centralizado de PDFs para certificados y boletines"""
    
    @staticmethod
    def generar_certificado_estudios(data):
        """
        Genera certificado de estudios
        Args:
            data: {
                'estudiante': {'nombre': str, 'codigo': str, 'documento': str},
                'institucion': {'nombre': str, 'nit': str, 'direccion': str},
                'grado': str,
                'periodo': str
            }
        Returns:
            BytesIO: PDF en memoria
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        Story = []
        styles = getSampleStyleSheet()
        
        # Estilo personalizado para título
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        # Encabezado institucional
        Story.append(Paragraph(data['institucion']['nombre'], title_style))
        Story.append(Paragraph(f"NIT: {data['institucion']['nit']}", styles['Normal']))
        Story.append(Paragraph(data['institucion']['direccion'], styles['Normal']))
        Story.append(Spacer(1, 0.5*inch))
        
        # Título del certificado
        cert_title = ParagraphStyle('CertTitle', parent=styles['Heading1'], fontSize=16, alignment=TA_CENTER, spaceAfter=20)
        Story.append(Paragraph("CERTIFICADO DE ESTUDIOS", cert_title))
        Story.append(Spacer(1, 0.3*inch))
        
        # Cuerpo del certificado
        body_text = f"""
        <para>
        El suscrito Rector de <b>{data['institucion']['nombre']}</b> certifica que:
        <br/><br/>
        <b>{data['estudiante']['nombre'].upper()}</b><br/>
        Identificado(a) con documento No. <b>{data['estudiante']['documento']}</b><br/>
        Código estudiantil: <b>{data['estudiante']['codigo']}</b><br/><br/>
        
        Se encuentra matriculado(a) en el grado <b>{data['grado']}</b> durante el periodo académico <b>{data['periodo']}</b>.
        <br/><br/>
        Se expide la presente certificación a solicitud del interesado(a) el día {datetime.now().strftime('%d de %B de %Y')}.
        </para>
        """
        Story.append(Paragraph(body_text, styles['BodyText']))
        Story.append(Spacer(1, 1*inch))
        
        # Firma
        firma_style = ParagraphStyle('Firma', parent=styles['Normal'], alignment=TA_CENTER)
        Story.append(Paragraph("_______________________________", firma_style))
        Story.append(Paragraph("Firma del Rector", firma_style))
        
        doc.build(Story)
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def generar_boletin_notas(data):
        """
        Genera boletín de calificaciones
        Args:
            data: {
                'estudiante': {'nombre': str, 'codigo': str},
                'periodo': str,
                'materias': [{'nombre': str, 'nota1': float, 'nota2': float, 'nota3': float, 'promedio': float}],
                'promedio_general': float
            }
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        Story = []
        styles = getSampleStyleSheet()
        
        # Encabezado
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=16)
        Story.append(Paragraph("BOLETÍN DE CALIFICACIONES", title_style))
        Story.append(Spacer(1, 0.3*inch))
        
        # Información del estudiante
        info = f"""
        <b>Estudiante:</b> {data['estudiante']['nombre']}<br/>
        <b>Código:</b> {data['estudiante']['codigo']}<br/>
        <b>Periodo:</b> {data['periodo']}<br/>
        <b>Fecha:</b> {datetime.now().strftime('%d/%m/%Y')}
        """
        Story.append(Paragraph(info, styles['Normal']))
        Story.append(Spacer(1, 0.3*inch))
        
        # Tabla de calificaciones
        table_data = [['Materia', 'Nota 1', 'Nota 2', 'Nota 3', 'Promedio']]
        for materia in data['materias']:
            table_data.append([
                materia['nombre'],
                f"{materia['nota1']:.1f}",
                f"{materia['nota2']:.1f}",
                f"{materia['nota3']:.1f}",
                f"{materia['promedio']:.2f}"
            ])
        
        # Promedio general
        table_data.append(['', '', '', 'PROMEDIO GENERAL:', f"{data['promedio_general']:.2f}"])
        
        table = Table(table_data, colWidths=[3*inch, 1*inch, 1*inch, 1*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        
        Story.append(table)
        
        doc.build(Story)
        buffer.seek(0)
        return buffer