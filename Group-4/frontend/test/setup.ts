import '@testing-library/jest-dom/vitest'

// Radix (shadcn Select) tarayici pointer/layout API'lerine dayanir; jsdom
// bunlari uygulamaz ve bilesen acilirken TypeError firlatir. Testte davranis
// degistirmeyiz, yalnizca eksik primitifleri tamamlariz.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
// ResizeObserver BILEREK doldurulmaz: Recharts'in ResponsiveContainer'i onun
// yoklugunda test-dostu bir yola dusuyor; no-op bir sahte eklemek olculeri
// 0'da birakip grafik testlerini kirmisti (score-trend-chart.test.tsx).
