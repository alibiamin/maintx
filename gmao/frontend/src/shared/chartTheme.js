/**
 * Thème ApexCharts - Palette Sage X3
 * Vert #2EB23E, accent orange #FFBF00, bleu-gris #F0F8FF
 */
export const CHART_COLORS = [
  '#2EB23E',   // Vert Sage
  '#FFBF00',   // Orange accent
  '#3b82f6',   // Bleu
  '#8b5cf6',   // Violet
  '#ef4444',   // Rouge
  '#64748b'    // Gris
];

export const apexChartTheme = (isDark) => ({
  mode: isDark ? 'dark' : 'light',
  palette: 'palette1',
  monochrome: { enabled: false },
  colors: CHART_COLORS,
  chart: {
    background: 'transparent',
    foreColor: isDark ? '#94a3b8' : '#64748b',
    fontFamily: '"Outfit", "Segoe UI", sans-serif',
    toolbar: { show: false }
  },
  grid: {
    borderColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } }
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  fill: { opacity: 0.9 },
  legend: {
    position: 'bottom',
    labels: { colors: isDark ? '#94a3b8' : '#64748b' }
  },
  tooltip: {
    theme: isDark ? 'dark' : 'light',
    x: { format: 'dd/MM/yyyy' }
  },
  xaxis: {
    labels: { style: { colors: isDark ? '#94a3b8' : '#64748b' } }
  },
  yaxis: {
    labels: { style: { colors: isDark ? '#94a3b8' : '#64748b' } }
  },
  plotOptions: {
    bar: {
      borderRadius: 6,
      columnWidth: '60%',
      distributed: true
    },
    radialBar: {
      dataLabels: {
        value: { color: isDark ? '#fff' : '#333' },
        total: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    },
    pie: {
      donut: { labels: { show: true } }
    }
  }
});
