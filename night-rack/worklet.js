import { Engine } from './engine.js';

class RackEngine extends AudioWorkletProcessor {
  constructor() {
    super();
    this.e = new Engine(sampleRate, 128);
    this.k = 0;
    this.port.onmessage = ev => { for (const m of ev.data) this.e.handle(m); };
  }
  process(inputs, outputs) {
    const o = outputs[0];
    this.e.process(128);
    o[0].set(this.e.oL);
    if (o[1]) o[1].set(this.e.oR);
    if (++this.k >= 10) { this.k = 0; this.port.postMessage(this.e.telemetry()); }
    return true;
  }
}
registerProcessor('rack-engine', RackEngine);
