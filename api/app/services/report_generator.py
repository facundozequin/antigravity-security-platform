import os
import asyncio
from datetime import datetime, timedelta
import matplotlib
matplotlib.use('Agg') # Set non-interactive backend
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from app.db.database import AsyncSessionLocal, get_clickhouse
from app.db.models import SecurityReport, SecurityAlert, IPReputationCache
from sqlalchemy import select, func, desc
from app.services.ai_service import AIService
from app.config import settings
import io
import json
import logging

logger = logging.getLogger(__name__)

class ReportGeneratorService:
    @classmethod
    async def generate_report(cls, report_id: int):
        """Main entry point for async report generation"""
        async with AsyncSessionLocal() as db:
            report = await db.get(SecurityReport, report_id)
            if not report:
                return

            try:
                report.status = "processing"
                await db.commit()

                # 1. Gather Data
                data = await cls._gather_report_data(db, report.report_type)
                
                # 2. Generate AI Summary
                report.ai_summary = await cls._generate_ai_summary(db, data)
                report.stats_json = data
                
                # 3. Build PDF
                filename = f"report_{report.report_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
                # Updated path to be absolute within the expected structure
                storage_path = os.path.join(os.getcwd(), "app", "storage", "reports")
                os.makedirs(storage_path, exist_ok=True)
                full_path = os.path.join(storage_path, filename)
                
                cls._build_pdf(full_path, data, report.ai_summary)
                
                report.file_path = full_path
                report.status = "ready"
                await db.commit()
                logger.info(f"Report: Generated {filename} successfully")
            except Exception as e:
                report.status = "failed"
                await db.commit()
                logger.error(f"Report: Generation failed for {report_id}: {e}")

    @classmethod
    async def _gather_report_data(cls, db, report_type):
        """Aggregate data for the report"""
        days = 1 if report_type == "daily" else (7 if report_type == "weekly" else 30)
        since = datetime.utcnow() - timedelta(days=days)

        # Top Attackers (Postgres)
        stmt = select(
            IPReputationCache.client_ip,
            IPReputationCache.reputation_score,
            (IPReputationCache.waf_strikes + IPReputationCache.auth_strikes + IPReputationCache.ai_strikes).label("total_strikes"),
            IPReputationCache.country_code,
            IPReputationCache.isp
        ).order_by(desc("total_strikes")).limit(10)
        
        res = await db.execute(stmt)
        top_attackers = res.all()

        # Risk Trends (Postgres)
        trend_stmt = select(
            func.date_trunc('hour', SecurityAlert.timestamp).label("h"),
            func.avg(SecurityAlert.risk_score).label("avg_risk")
        ).where(SecurityAlert.timestamp >= since).group_by("h").order_by("h")
        
        trend_res = await db.execute(trend_stmt)
        trends = trend_res.all()

        # Traffic Volume (ClickHouse)
        ch = get_clickhouse()
        ch_sql = f"SELECT count() as c FROM security_platform.nginx_logs WHERE timestamp > now() - INTERVAL {days} DAY"
        res_ch = ch.query(ch_sql).result_rows
        total_requests = res_ch[0][0] if res_ch else 0

        return {
            "timeframe": report_type,
            "period": f"{since.strftime('%Y-%m-%d')} to {datetime.utcnow().strftime('%Y-%m-%d')}",
            "total_requests": total_requests,
            "top_attackers": [{
                "ip": r.client_ip,
                "score": r.reputation_score,
                "strikes": r.total_strikes,
                "geo": f"{r.country_code or '??'}",
                "isp": r.isp or "Unknown"
            } for r in top_attackers],
            "trends": [{"t": r.h.strftime("%H:%M"), "v": float(r.avg_risk)} for r in trends]
        }

    @classmethod
    async def _generate_ai_summary(cls, db, data):
        """Call AI provider for executive summary"""
        try:
            provider = await AIService.get_active_provider(db)
            if not provider:
                return "AI provider not configured. Manual audit recommended."
            
            prompt = f"""
            Analyze this security data for the last {data['timeframe']} period:
            - Period: {data['period']}
            - Total Requests: {data['total_requests']}
            - Top Attackers: {json.dumps(data['top_attackers'][:3])}
            - Risk Trend context: Avg risk values {json.dumps([t['v'] for t in data['trends'][-5:]])}
            
            Provide a professional Executive Summary for a SOC report.
            Include:
            1. Threat Overview
            2. Anomalies detected
            3. Recommendations
            Keep it concise and actionable.
            """
            return await provider.generate_response(prompt)
        except Exception as e:
            logger.error(f"Report: AI summary failed: {e}")
            return "Forensic summary currently unavailable."

    @staticmethod
    def _build_pdf(path, data, ai_summary):
        doc = SimpleDocTemplate(path, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Custom Styles
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=colors.HexColor("#3b82f6"))
        header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=16, spaceBefore=15, spaceAfter=10, textColor=colors.HexColor("#1e293b"))
        body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, textColor=colors.HexColor("#475569"))
        summary_box_style = ParagraphStyle('SummaryBox', parent=styles['Normal'], fontSize=11, leading=16, textColor=colors.HexColor("#0f172a"), leftIndent=10, borderPadding=10, backColor=colors.HexColor("#f1f5f9"))
        
        elements = []

        # Title
        elements.append(Paragraph(f"Security Forensic Report - {data['timeframe'].upper()}", title_style))
        elements.append(Paragraph(f"Reporting Period: {data['period']}", body_style))
        elements.append(Spacer(1, 0.2*inch))

        # AI Summary
        elements.append(Paragraph("Executive Summary & AI Forensic Analysis", header_style))
        elements.append(Paragraph(ai_summary.replace('\n', '<br/>'), summary_box_style))
        elements.append(Spacer(1, 0.3*inch))

        # Chart: Risk Trend
        if data['trends']:
            img_data = io.BytesIO()
            plt.figure(figsize=(6, 3))
            plt.plot([t['t'] for t in data['trends']], [t['v'] for t in data['trends']], color='#ef4444', linewidth=2)
            plt.title('Risk Score Trend', fontsize=10, color='#64748b')
            plt.xticks(rotation=45, fontsize=6)
            plt.yticks(fontsize=8)
            plt.grid(True, linestyle='--', alpha=0.3)
            plt.tight_layout()
            plt.savefig(img_data, format='png', dpi=100)
            plt.close()
            img_data.seek(0)
            elements.append(Image(img_data, width=5.5*inch, height=2.5*inch))
            elements.append(Spacer(1, 0.2*inch))

        # Top Attackers Table
        elements.append(Paragraph("Top Adversary Profiles", header_style))
        table_data = [["IP Address", "Geo", "Strikes", "Rep Score", "ISP"]]
        for p in data['top_attackers']:
            table_data.append([p['ip'], p['geo'], str(p['strikes']), f"{p['score']}%", p['isp'][:30]])
        
        t = Table(table_data, colWidths=[1.5*inch, 0.5*inch, 0.8*inch, 0.8*inch, 2.0*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(t)

        doc.build(elements)
