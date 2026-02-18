export interface AudioRecorderOptions {
  onData?: (blob: Blob) => void
  onStop?: (blob: Blob) => void
  onError?: (error: Error) => void
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  async start(options: AudioRecorderOptions = {}) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Standardize mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg;codecs=opus'

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })
      this.chunks = []

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data)
          options.onData?.(e.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' })
        options.onStop?.(blob)
      }

      this.mediaRecorder.onerror = () => {
        options.onError?.(new Error('MediaRecorder error'))
      }

      this.mediaRecorder.start()
    }
    catch (err: any) {
      console.error('Failed to start recording', err)
      throw err
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
    }
  }

  get isRecording() {
    return this.mediaRecorder?.state === 'recording'
  }
}

export const audioRecorder = new AudioRecorder()
