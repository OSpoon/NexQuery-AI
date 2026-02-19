export interface AudioRecorderOptions {
  onData?: (blob: Blob) => void
  onStop?: (blob: Blob) => void
  onError?: (error: Error) => void
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  async prepare() {
    if (this.stream && this.stream.active) {
      return this.stream
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      return this.stream
    }
    catch (err: any) {
      console.error('Failed to prepare stream', err)
      throw err
    }
  }

  async start(options: AudioRecorderOptions = {}) {
    try {
      // Use existing stream if active, or prepare a new one
      const stream = await this.prepare()

      // Standardize mime type with better compatibility check
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg',
      ]
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || ''

      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      this.chunks = []

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data)
          options.onData?.(e.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        const finalType = this.mediaRecorder?.mimeType || 'audio/webm'
        const blob = new Blob(this.chunks, { type: finalType })

        // Stop stream tracks immediately to respect user privacy and remove the 'mic in use' indicator
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop())
          this.stream = null
        }

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
  }

  close() {
    this.stop()
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
  }

  get isRecording() {
    return this.mediaRecorder?.state === 'recording'
  }
}

export const audioRecorder = new AudioRecorder()
