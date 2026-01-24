import { ref } from 'vue'

export interface WatermarkOptions {
  width?: number
  height?: number
  content?: string[]
  font?: string
  color?: string
  rotate?: number
  zIndex?: number
}

export function useWatermark() {
  const watermarkUrl = ref('')

  const createWatermark = (options: WatermarkOptions = {}) => {
    const {
      width = 300,
      height = 300,
      content = ['NexQuery AI', 'Confidential'],
      font = '16px Microsoft Yahei',
      color = 'rgba(100, 100, 100, 0.15)', // Default low opacity
      rotate = -20,
    } = options

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.rotate((rotate * Math.PI) / 180)
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Draw content relative to the center of the rotated coordinate system
      // We need to adjust drawing coordinates because of rotation
      // A simple way for diagonal watermark is to draw at offsets
      content.forEach((text, index) => {
        // Adjust Y position for multiple lines
        const yOffset = index * 25
        ctx.fillText(text, width / 4, height / 2 + yOffset)
      })

      watermarkUrl.value = canvas.toDataURL('image/png')
    }
  }

  const clearWatermark = () => {
    watermarkUrl.value = ''
  }

  return {
    watermarkUrl,
    createWatermark,
    clearWatermark,
  }
}
