class PcmWorklet extends AudioWorkletProcessor {
	constructor(opts) {
		super();
		this.target = opts.processorOptions.targetSampleRate ?? 16000;
		this.chunkMs = opts.processorOptions.chunkMs ?? 100;
		this.inRate = sampleRate; // AudioWorklet global
		this.buf = [];
		this.samplesPerChunk = Math.round(this.target * (this.chunkMs / 1000));
	}

	downsample(float32) {
		const ratio = this.inRate / this.target;
		const outLen = Math.floor(float32.length / ratio);
		const out = new Int16Array(outLen);

		for (let i = 0; i < outLen; i++) {
			const idx = Math.floor(i * ratio);
			let s = float32[idx] ?? 0;
			s = Math.max(-1, Math.min(1, s));
			out[i] = (s * 0x7fff) | 0;
		}
		return out;
	}

	process(inputs) {
		const ch0 = inputs[0]?.[0];
		if (!ch0) return true;

		const pcm = this.downsample(ch0);
		for (let i = 0; i < pcm.length; i++) this.buf.push(pcm[i]);

		while (this.buf.length >= this.samplesPerChunk) {
			const chunk = this.buf.splice(0, this.samplesPerChunk);
			const ab = new Int16Array(chunk).buffer;
			this.port.postMessage(ab, [ab]);
		}
		return true;
	}
}

registerProcessor("pcm-worklet", PcmWorklet);