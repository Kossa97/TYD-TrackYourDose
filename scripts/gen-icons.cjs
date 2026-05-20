// Converts public/icon.svg → public/icon-192.png + public/icon-512.png
const { Resvg } = require('@resvg/resvg-js')
const fs = require('fs')
const path = require('path')

const svgPath = path.join(__dirname, '../public/icon.svg')
const svg = fs.readFileSync(svgPath)

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const outPath = path.join(__dirname, `../public/icon-${size}.png`)
  fs.writeFileSync(outPath, pngBuffer)
  console.log(`✓ icon-${size}.png  (${pngBuffer.length} bytes)`)
}
