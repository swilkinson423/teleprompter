import pcmWorkletUrl from "./pcm-worklet.js?url";

export async function startMicPcm16k(onChunk: (ab: ArrayBuffer) => void, deviceId?: string) {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: deviceId ? { deviceId: { exact: deviceId } } : true,
	});

	const ctx = new AudioContext({ sampleRate: 48000 });
	await ctx.audioWorklet.addModule(pcmWorkletUrl);

	const src = ctx.createMediaStreamSource(stream);
	const node = new AudioWorkletNode(ctx, "pcm-worklet", {
		processorOptions: { targetSampleRate: 16000, chunkMs: 100 }
	});

	node.port.onmessage = (e) => onChunk(e.data as ArrayBuffer);

	src.connect(node);

	return () => {
		try { node.disconnect(); } catch {}
		try { src.disconnect(); } catch {}
		stream.getTracks().forEach((t) => t.stop());
		ctx.close();
	};
}
