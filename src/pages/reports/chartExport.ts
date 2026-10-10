import { displayNumber } from "@/utils/displayNumber";
import type { ReportChartRow } from "./reportChartData";

type ExportSeries = { key: keyof ReportChartRow; label: string; color: string; dash?: string; width?: number; marker?: string };
export type ExportChart = { title: string; series: ExportSeries[]; stacked: boolean };
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[character]!));

/** A separate vector layout exports the entire timeline, not the scrolled viewport. */
export function buildChartReport(rows: ReportChartRow[], charts: ExportChart[], resolveColor: (color: string) => string, period: string) {
  const width = 1440, panelHeight = 430;
  const pages: string[] = [];
  for (let offset = 0; offset < rows.length; offset += 20) {
    const slice = rows.slice(offset, offset + 20);
    const panels = charts.map((chart, index) => {
      const left = 80, right = 1390, top = 110, bottom = 355;
      const x = (i: number) => left + (i + 0.5) * (right - left) / slice.length;
      const max = Math.max(1, ...rows.map(row => chart.stacked ? chart.series.reduce((sum, series) => sum + Number(row[series.key] ?? 0), 0) : Math.max(0, ...chart.series.map(series => Number(row[series.key] ?? 0)))));
      const rough = Math.max(1, max / 4), magnitude = 10 ** Math.floor(Math.log10(rough));
      const step = [1,2,2.5,5,10].map(n => n * magnitude).find(n => Number.isInteger(n) && n >= rough) ?? Math.ceil(rough);
      const y = (value: number) => bottom - value / (step * 4) * (bottom - top);
      const marker = (series: ExportSeries, px: number, py: number) => {
        const color = escape(resolveColor(series.color));
        return series.marker === "square" ? `<rect x="${px-5}" y="${py-5}" width="10" height="10" fill="white" stroke="${color}" stroke-width="2.5"/>`
          : series.marker === "triangle" ? `<path d="M${px} ${py-6}l6 11h-12Z" fill="white" stroke="${color}" stroke-width="2"/>`
          : series.marker === "diamond" ? `<path d="M${px} ${py-6}l6 6-6 6-6-6Z" fill="white" stroke="${color}" stroke-width="2"/>`
          : `<circle cx="${px}" cy="${py}" r="4" fill="${color}"/>`;
      };
      const legend = chart.series.map((series,i) => `<g transform="translate(${80+i*315},68)"><line x2="30" stroke="${escape(resolveColor(series.color))}" stroke-width="${series.width ?? 2}" stroke-dasharray="${series.dash ?? ''}"/>${marker(series,15,0)}<text x="40" y="5" font-size="15">${escape(series.label)}</text></g>`).join('');
      const grid = [0,1,2,3,4].map(i => `<line x1="${left}" x2="${right}" y1="${y(step*i)}" y2="${y(step*i)}" stroke="#dce0e8"/><text x="65" y="${y(step*i)+5}" text-anchor="end" font-size="13">${displayNumber(step*i)}</text>`).join('');
      const lines = chart.series.map((series,seriesIndex) => {
        const color = escape(resolveColor(series.color));
        if (chart.stacked) return slice.map((row,i) => { const base = chart.series.slice(0,seriesIndex).reduce((sum,s) => sum + Number(row[s.key] ?? 0),0); const value = Number(row[series.key] ?? 0); return `<rect x="${x(i)-14}" y="${y(base+value)}" width="28" height="${y(base)-y(base+value)}" fill="${color}"/>`; }).join('');
        let drawing = false;
        const path = slice.map((row,i) => { const value = row[series.key]; if(value == null) {drawing=false;return '';} const command = drawing ? 'L':'M';drawing=true;return `${command}${x(i)},${y(Number(value))}`; }).join(' ');
        return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${series.width ?? 2}" stroke-dasharray="${series.dash ?? ''}"/>` + slice.map((row,i) => row[series.key] == null ? '' : marker(series,x(i),y(Number(row[series.key])))).join('');
      }).join('');
      const labels = slice.map((row,i) => `<text x="${x(i)}" y="385" text-anchor="middle" font-size="12">${escape(row.label)}</text>`).join('');
      return `<g transform="translate(0,${index*panelHeight})"><text x="40" y="32" font-size="22" font-weight="600">${escape(chart.title)}</text>${legend}${grid}${lines}${labels}</g>`;
    }).join('');
    const height = 105 + charts.length * panelHeight;
    pages.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family:Arial,sans-serif;color:#172033"><rect width="100%" height="100%" fill="white"/><text x="40" y="30" font-size="17" font-weight="600">HPH · Performance report</text><text x="40" y="57" font-size="14">${escape(period)} · ${escape(slice[0].label)} – ${escape(slice[slice.length-1].label)}</text><g transform="translate(0,80)">${panels}</g><text x="40" y="${height-12}" font-size="11" fill="#657083">Selected series only · ${offset+1}–${offset+slice.length} of ${rows.length} reporting points · CPD normalized to 8 hours</text></svg>`);
  }
  return pages;
}

export async function downloadChartPng(svg: string, filename: string) {
  const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width*2;canvas.height=image.height*2;
    const context=canvas.getContext('2d'); if(!context) throw new Error('Image export is unavailable.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image export failed.')), 'image/png'));
    const downloadUrl = URL.createObjectURL(blob); const link=document.createElement('a');link.href=downloadUrl;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);
  } finally {URL.revokeObjectURL(url);}
}

export function printChartReport(pages: string[]) {
  const popup=window.open('', '_blank'); if(!popup) throw new Error('Allow pop-ups to open the PDF print preview.');
  popup.document.write(`<!doctype html><html><head><title>HPH performance report</title><style>@page{size:A4 landscape;margin:8mm}body{margin:0}section{break-after:page}section:last-child{break-after:auto}svg{display:block;width:100%;height:auto;max-height:190mm}button{margin:12px;padding:10px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button>${pages.map(page=>`<section>${page}</section>`).join('')}</body></html>`);
  popup.document.close(); popup.onload=()=>popup.print();
}
